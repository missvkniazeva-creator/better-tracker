import type { DB } from '../db/index.ts';
import { readSettings } from './settings.ts';
import type {
  BoardSnapshot,
  Column,
  Label,
  Lane,
  LogEntry,
  Objective,
  Outcome,
  Task,
  TaskImage,
} from '../../../../shared/types.ts';

/**
 * The whole board in one read.
 *
 * A single user's tracker is small (thousands of rows at the outside), and every
 * panel -- objectives roll-ups, outcome contribution bars, the log's year view --
 * needs cross-cuts of the same data. Paginating that would cost more in round
 * trips and client-side stitching than it saves. Read it all, diff on the client.
 */
export function readBoard(d: DB): BoardSnapshot {
  return {
    lanes: readLanes(d),
    tasks: readTasks(d),
    objectives: readObjectives(d),
    outcomes: readOutcomes(d),
    labels: readLabels(d),
    settings: readSettings(d),
  };
}

export function readLanes(d: DB): Lane[] {
  const lanes = d
    .prepare('SELECT id, name, hint, color, position FROM lanes ORDER BY position')
    .all() as Omit<Lane, 'columns'>[];

  const columns = d
    .prepare('SELECT id, lane_id, name, position FROM columns ORDER BY position')
    .all() as { id: string; lane_id: string; name: string; position: number }[];

  const byLane = new Map<string, Column[]>();
  for (const c of columns) {
    const list = byLane.get(c.lane_id) ?? [];
    list.push({ id: c.id, laneId: c.lane_id, name: c.name, position: c.position });
    byLane.set(c.lane_id, list);
  }
  return lanes.map((l) => ({ ...l, columns: byLane.get(l.id) ?? [] }));
}

export function readLabels(d: DB): Label[] {
  return d
    .prepare('SELECT id, name, hue, position FROM labels ORDER BY position')
    .all() as unknown as Label[];
}

export function readObjectives(d: DB): Objective[] {
  const rows = d
    .prepare(
      'SELECT id, parent_id, name, measure, year, archived, position ' +
        'FROM objectives ORDER BY position',
    )
    .all() as {
    id: string;
    parent_id: string | null;
    name: string;
    measure: string;
    year: number;
    archived: number;
    position: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    measure: r.measure,
    year: r.year,
    archived: r.archived === 1,
    position: r.position,
  }));
}

export function readOutcomes(d: DB): Outcome[] {
  const rows = d
    .prepare('SELECT id, name, description, date, position FROM outcomes ORDER BY position')
    .all() as {
    id: string;
    name: string;
    description: string;
    date: string;
    position: number;
  }[];

  // No objective links are read: an outcome's objectives are whichever objectives its
  // *cards* also carry, derived on the client from task_objectives + task_outcomes.
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    date: r.date,
    position: r.position,
  }));
}

export function readTasks(d: DB): Task[] {
  const rows = d
    .prepare(
      'SELECT id, lane_id, column_id, title, description, obstacles, priority, severity, ' +
        'dateline, archived, x, y, position FROM tasks ORDER BY position, created_at',
    )
    .all() as {
    id: string;
    lane_id: string | null;
    column_id: string | null;
    title: string;
    description: string;
    obstacles: string;
    priority: Task['priority'];
    severity: Task['severity'];
    dateline: string;
    archived: number;
    x: number;
    y: number;
    position: number;
  }[];

  const labels = groupPairs(
    d.prepare('SELECT task_id, label_id FROM task_labels').all() as Pair[],
  );
  const objectives = groupPairs(
    d.prepare('SELECT task_id, objective_id FROM task_objectives').all() as Pair[],
  );
  const outcomes = groupPairs(
    d.prepare('SELECT task_id, outcome_id FROM task_outcomes').all() as Pair[],
  );
  const images = readImages(d);
  const log = readLog(d);

  return rows.map((r) => ({
    id: r.id,
    laneId: r.lane_id,
    columnId: r.column_id,
    title: r.title,
    description: r.description,
    obstacles: r.obstacles,
    priority: r.priority,
    severity: r.severity,
    dateline: r.dateline,
    archived: r.archived === 1,
    x: r.x,
    y: r.y,
    position: r.position,
    labelIds: labels.get(r.id) ?? [],
    objectiveIds: objectives.get(r.id) ?? [],
    outcomeIds: outcomes.get(r.id) ?? [],
    images: images.get(r.id) ?? [],
    log: log.get(r.id) ?? [],
  }));
}

function readImages(d: DB): Map<string, TaskImage[]> {
  // `bytes` is deliberately not selected: images are fetched one at a time from
  // /api/images/:id so the board snapshot stays small.
  const rows = d
    .prepare('SELECT id, task_id, name, mime FROM task_images ORDER BY position')
    .all() as { id: string; task_id: string; name: string; mime: string }[];
  const out = new Map<string, TaskImage[]>();
  for (const r of rows) {
    const list = out.get(r.task_id) ?? [];
    list.push({ id: r.id, name: r.name, mime: r.mime, url: `/api/images/${r.id}` });
    out.set(r.task_id, list);
  }
  return out;
}

export function readLog(d: DB): Map<string, LogEntry[]> {
  const rows = d
    .prepare(
      'SELECT id, task_id, date, type, note, hours FROM log_entries ORDER BY date DESC, created_at DESC',
    )
    .all() as {
    id: string;
    task_id: string;
    date: string;
    type: LogEntry['type'];
    note: string;
    hours: number;
  }[];

  const tokens = d
    .prepare('SELECT entry_id, kind, value FROM log_entry_tokens ORDER BY position')
    .all() as { entry_id: string; kind: 'artefact' | 'value' | 'person'; value: string }[];
  const outcomes = d
    .prepare('SELECT entry_id, outcome_id FROM log_entry_outcomes')
    .all() as { entry_id: string; outcome_id: string }[];

  const tokenBy = new Map<string, { artefacts: string[]; values: string[]; people: string[] }>();
  for (const t of tokens) {
    const bag = tokenBy.get(t.entry_id) ?? { artefacts: [], values: [], people: [] };
    if (t.kind === 'artefact') bag.artefacts.push(t.value);
    else if (t.kind === 'value') bag.values.push(t.value);
    else bag.people.push(t.value);
    tokenBy.set(t.entry_id, bag);
  }
  const outcomeBy = new Map<string, string[]>();
  for (const o of outcomes) {
    const list = outcomeBy.get(o.entry_id) ?? [];
    list.push(o.outcome_id);
    outcomeBy.set(o.entry_id, list);
  }

  const out = new Map<string, LogEntry[]>();
  for (const r of rows) {
    const bag = tokenBy.get(r.id);
    const list = out.get(r.task_id) ?? [];
    list.push({
      id: r.id,
      taskId: r.task_id,
      date: r.date,
      type: r.type,
      note: r.note,
      hours: r.hours,
      artefacts: bag?.artefacts ?? [],
      values: bag?.values ?? [],
      people: bag?.people ?? [],
      outcomeIds: outcomeBy.get(r.id) ?? [],
    });
    out.set(r.task_id, list);
  }
  return out;
}

type Pair = { task_id: string } & Record<string, string>;

function groupPairs(rows: Pair[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const value = Object.entries(row).find(([k]) => k !== 'task_id')?.[1] as string;
    const list = out.get(row.task_id) ?? [];
    list.push(value);
    out.set(row.task_id, list);
  }
  return out;
}
