import type { DB } from '../db/index.ts';
import { newId, tx } from '../db/index.ts';
import { readTasks } from './board.ts';
import type { Priority, Severity, Task } from '../../../../shared/types.ts';

const STEP = 1000;

export interface TaskInput {
  laneId?: string | null;
  columnId?: string | null;
  title?: string;
  description?: string;
  obstacles?: string;
  priority?: Priority;
  severity?: Severity;
  dateline?: string;
  archived?: boolean;
  x?: number;
  y?: number;
  labelIds?: string[];
  objectiveIds?: string[];
  outcomeIds?: string[];
}

export function createTask(d: DB, input: TaskInput): Task {
  return tx(d, () => {
    const id = newId('task');
    const { m } = d
      .prepare('SELECT COALESCE(MAX(position), 0) AS m FROM tasks WHERE column_id IS ?')
      .get(input.columnId ?? null) as { m: number };

    d.prepare(
      'INSERT INTO tasks (id, lane_id, column_id, title, description, obstacles, priority, ' +
        'severity, dateline, x, y, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      input.laneId ?? null,
      input.columnId ?? null,
      input.title ?? '',
      input.description ?? '',
      input.obstacles ?? '',
      input.priority ?? 'P2',
      input.severity ?? 'Low',
      input.dateline ?? '',
      input.x ?? 0,
      input.y ?? 0,
      m + STEP,
    );
    writeRelations(d, id, input);
    return findTask(d, id)!;
  });
}

export function updateTask(d: DB, id: string, patch: TaskInput): Task | null {
  return tx(d, () => {
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    const col = (name: string, value: string | number | null | undefined) => {
      if (value === undefined) return;
      sets.push(`${name} = ?`);
      args.push(value);
    };
    col('title', patch.title);
    col('description', patch.description);
    col('obstacles', patch.obstacles);
    col('priority', patch.priority);
    col('severity', patch.severity);
    col('dateline', patch.dateline);
    col('x', patch.x);
    col('y', patch.y);
    if (patch.archived !== undefined) col('archived', patch.archived ? 1 : 0);

    if (sets.length) {
      sets.push("updated_at = datetime('now')");
      args.push(id);
      d.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    }
    writeRelations(d, id, patch);
    return findTask(d, id);
  });
}

/**
 * Move a card. `columnId: null` means the Intake canvas, where x/y matter and
 * position does not; inside a column the reverse holds.
 */
export function moveTask(
  d: DB,
  id: string,
  to: { laneId: string | null; columnId: string | null; x?: number; y?: number; index?: number },
): Task | null {
  return tx(d, () => {
    const position =
      to.columnId === null
        ? 0
        : positionForIndex(d, to.columnId, to.index ?? Number.MAX_SAFE_INTEGER, id);

    d.prepare(
      'UPDATE tasks SET lane_id = ?, column_id = ?, x = ?, y = ?, position = ?, ' +
        "updated_at = datetime('now') WHERE id = ?",
    ).run(to.laneId, to.columnId, to.x ?? 0, to.y ?? 0, position, id);
    return findTask(d, id);
  });
}

/**
 * Position that lands a card at `index` in its column, midway between neighbours.
 * Fractional positions keep a move to one UPDATE; the gap only needs renumbering
 * if it ever collapses, which at STEP=1000 takes ~50 successive inserts.
 */
function positionForIndex(d: DB, columnId: string, index: number, movingId: string): number {
  const rows = d
    .prepare('SELECT id, position FROM tasks WHERE column_id = ? AND id != ? ORDER BY position')
    .all(columnId, movingId) as { id: string; position: number }[];

  const clamped = Math.max(0, Math.min(index, rows.length));
  const before = clamped > 0 ? rows[clamped - 1]!.position : 0;
  const after = clamped < rows.length ? rows[clamped]!.position : before + 2 * STEP;
  return (before + after) / 2;
}

/**
 * Duplicate a card: fields, labels, objectives, outcomes and pasted images.
 *
 * The activity log is **not** copied — those entries record what happened on the
 * original, and attributing them to a new card would double every contribution
 * count and every heatmap week.
 */
export function copyTask(d: DB, id: string): Task | null {
  return tx(d, () => {
    const source = d
      .prepare(
        'SELECT lane_id, column_id, title, description, obstacles, priority, severity, ' +
          'dateline, x, y, position FROM tasks WHERE id = ?',
      )
      .get(id) as
      | {
          lane_id: string | null;
          column_id: string | null;
          title: string;
          description: string;
          obstacles: string;
          priority: string;
          severity: string;
          dateline: string;
          x: number;
          y: number;
          position: number;
        }
      | undefined;
    if (!source) return null;

    const copyId = newId('task');
    d.prepare(
      'INSERT INTO tasks (id, lane_id, column_id, title, description, obstacles, priority, ' +
        'severity, dateline, x, y, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      copyId,
      source.lane_id,
      source.column_id,
      source.title,
      source.description,
      source.obstacles,
      source.priority,
      source.severity,
      source.dateline,
      // On the Intake canvas, offset the copy so it does not land exactly on top.
      source.lane_id === null ? source.x + 24 : source.x,
      source.lane_id === null ? source.y + 24 : source.y,
      source.position + STEP / 2,
    );

    for (const [table, column] of [
      ['task_labels', 'label_id'],
      ['task_objectives', 'objective_id'],
      ['task_outcomes', 'outcome_id'],
    ] as const) {
      d.prepare(
        `INSERT INTO ${table} (task_id, ${column}) SELECT ?, ${column} FROM ${table} WHERE task_id = ?`,
      ).run(copyId, id);
    }

    const images = d
      .prepare('SELECT name, mime, bytes, position FROM task_images WHERE task_id = ? ORDER BY position')
      .all(id) as { name: string; mime: string; bytes: Uint8Array; position: number }[];
    const insertImage = d.prepare(
      'INSERT INTO task_images (id, task_id, name, mime, bytes, position) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const image of images) {
      insertImage.run(newId('img'), copyId, image.name, image.mime, image.bytes, image.position);
    }

    return findTask(d, copyId);
  });
}

export function deleteTask(d: DB, id: string): void {
  d.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

export function findTask(d: DB, id: string): Task | null {
  // One task is rare enough that reusing the board reader beats a parallel
  // single-row query path that could drift from it.
  return readTasks(d).find((t) => t.id === id) ?? null;
}

function writeRelations(d: DB, taskId: string, input: TaskInput): void {
  replaceSet(d, 'task_labels', 'label_id', taskId, input.labelIds);
  replaceSet(d, 'task_objectives', 'objective_id', taskId, input.objectiveIds);
  replaceSet(d, 'task_outcomes', 'outcome_id', taskId, input.outcomeIds);
}

function replaceSet(
  d: DB,
  table: string,
  column: string,
  taskId: string,
  ids: string[] | undefined,
): void {
  if (ids === undefined) return;
  d.prepare(`DELETE FROM ${table} WHERE task_id = ?`).run(taskId);
  const stmt = d.prepare(`INSERT INTO ${table} (task_id, ${column}) VALUES (?, ?)`);
  for (const id of new Set(ids)) stmt.run(taskId, id);
}

// ------------------------------------------------------------------- images

export function addImage(
  d: DB,
  taskId: string,
  file: { name: string; mime: string; bytes: Uint8Array },
): { id: string; url: string } {
  const id = newId('img');
  const { m } = d
    .prepare('SELECT COALESCE(MAX(position), 0) AS m FROM task_images WHERE task_id = ?')
    .get(taskId) as { m: number };
  d.prepare(
    'INSERT INTO task_images (id, task_id, name, mime, bytes, position) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, taskId, file.name, file.mime, file.bytes, m + STEP);
  return { id, url: `/api/images/${id}` };
}

export function readImage(d: DB, id: string): { mime: string; bytes: Uint8Array } | null {
  const row = d.prepare('SELECT mime, bytes FROM task_images WHERE id = ?').get(id) as
    | { mime: string; bytes: Uint8Array }
    | undefined;
  return row ?? null;
}

export function deleteImage(d: DB, id: string): void {
  d.prepare('DELETE FROM task_images WHERE id = ?').run(id);
}
