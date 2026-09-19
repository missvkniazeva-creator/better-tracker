import type { DB } from '../db/index.ts';
import { newId, tx } from '../db/index.ts';
import { readLanes } from './board.ts';
import type { Lane, LaneColor } from '../../../../shared/types.ts';

const STEP = 1000;

function nextPosition(d: DB, table: 'lanes' | 'columns', laneId?: string): number {
  const sql =
    table === 'lanes'
      ? 'SELECT COALESCE(MAX(position), 0) AS m FROM lanes'
      : 'SELECT COALESCE(MAX(position), 0) AS m FROM columns WHERE lane_id = ?';
  const row = (
    table === 'lanes' ? d.prepare(sql).get() : d.prepare(sql).get(laneId!)
  ) as { m: number };
  return row.m + STEP;
}

export function createLane(
  d: DB,
  input: { name: string; hint?: string; color?: LaneColor; columns?: string[] },
): Lane {
  return tx(d, () => {
    const id = newId('lane');
    d.prepare('INSERT INTO lanes (id, name, hint, color, position) VALUES (?, ?, ?, ?, ?)').run(
      id,
      input.name,
      input.hint ?? '',
      input.color ?? 'lane1',
      nextPosition(d, 'lanes'),
    );
    const cols = input.columns ?? ['Pending', 'In Action', 'Staged'];
    const stmt = d.prepare('INSERT INTO columns (id, lane_id, name, position) VALUES (?, ?, ?, ?)');
    cols.forEach((name, i) => stmt.run(newId('col'), id, name, (i + 1) * STEP));
    return readLanes(d).find((l) => l.id === id)!;
  });
}

export function updateLane(
  d: DB,
  id: string,
  patch: { name?: string; hint?: string; color?: LaneColor },
): void {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.name !== undefined) (sets.push('name = ?'), args.push(patch.name));
  if (patch.hint !== undefined) (sets.push('hint = ?'), args.push(patch.hint));
  if (patch.color !== undefined) (sets.push('color = ?'), args.push(patch.color));
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  args.push(id);
  d.prepare(`UPDATE lanes SET ${sets.join(', ')} WHERE id = ?`).run(...args);
}

export function reorderLanes(d: DB, orderedIds: string[]): void {
  tx(d, () => {
    const stmt = d.prepare('UPDATE lanes SET position = ? WHERE id = ?');
    orderedIds.forEach((id, i) => stmt.run((i + 1) * STEP, id));
  });
}

/**
 * Delete a lane, relocating its cards.
 *
 * `target` is another lane id, or 'intake'. Cards merge **by column name**: a card
 * in "In Action" lands in the target's "In Action", and if the target has no such
 * column it is created there -- so the source lane's card structure survives the
 * move, per the handoff's delete-lane dialog.
 */
export function deleteLane(d: DB, id: string, target: string | 'intake'): void {
  tx(d, () => {
    const cards = d
      .prepare(
        'SELECT t.id AS id, c.name AS col FROM tasks t ' +
          'LEFT JOIN columns c ON c.id = t.column_id WHERE t.lane_id = ?',
      )
      .all(id) as { id: string; col: string | null }[];

    if (target === 'intake') {
      // Stack relocated cards down the left edge of the canvas so none overlap.
      const { m } = d
        .prepare('SELECT COALESCE(MAX(y), 0) AS m FROM tasks WHERE lane_id IS NULL')
        .get() as { m: number };
      const move = d.prepare(
        'UPDATE tasks SET lane_id = NULL, column_id = NULL, x = 16, y = ? WHERE id = ?',
      );
      cards.forEach((c, i) => move.run(m + (i + 1) * 118, c.id));
    } else {
      const targetCols = d
        .prepare('SELECT id, name FROM columns WHERE lane_id = ?')
        .all(target) as { id: string; name: string }[];
      const byName = new Map(targetCols.map((c) => [c.name, c.id]));
      const insertCol = d.prepare(
        'INSERT INTO columns (id, lane_id, name, position) VALUES (?, ?, ?, ?)',
      );
      const move = d.prepare('UPDATE tasks SET lane_id = ?, column_id = ? WHERE id = ?');

      for (const card of cards) {
        const name = card.col ?? 'Pending';
        let colId = byName.get(name);
        if (!colId) {
          colId = newId('col');
          insertCol.run(colId, target, name, nextPosition(d, 'columns', target));
          byName.set(name, colId);
        }
        move.run(target, colId, card.id);
      }
    }
    // Cards are relocated above, so the ON DELETE CASCADE on tasks.lane_id has
    // nothing left to take with it.
    d.prepare('DELETE FROM lanes WHERE id = ?').run(id);
  });
}

export function createColumn(d: DB, laneId: string, name: string): void {
  d.prepare('INSERT INTO columns (id, lane_id, name, position) VALUES (?, ?, ?, ?)').run(
    newId('col'),
    laneId,
    name,
    nextPosition(d, 'columns', laneId),
  );
}

export function renameColumn(d: DB, id: string, name: string): void {
  d.prepare('UPDATE columns SET name = ? WHERE id = ?').run(name, id);
}

/** Cards in a deleted column fall back to the lane's first remaining column. */
export function deleteColumn(d: DB, id: string): void {
  tx(d, () => {
    const col = d.prepare('SELECT lane_id FROM columns WHERE id = ?').get(id) as
      | { lane_id: string }
      | undefined;
    if (!col) return;
    const fallback = d
      .prepare('SELECT id FROM columns WHERE lane_id = ? AND id != ? ORDER BY position LIMIT 1')
      .get(col.lane_id, id) as { id: string } | undefined;

    if (fallback) {
      d.prepare('UPDATE tasks SET column_id = ? WHERE column_id = ?').run(fallback.id, id);
    } else {
      d.prepare(
        'UPDATE tasks SET lane_id = NULL, column_id = NULL, x = 16 WHERE column_id = ?',
      ).run(id);
    }
    d.prepare('DELETE FROM columns WHERE id = ?').run(id);
  });
}

export function reorderColumns(d: DB, laneId: string, orderedIds: string[]): void {
  tx(d, () => {
    const stmt = d.prepare('UPDATE columns SET position = ? WHERE id = ? AND lane_id = ?');
    orderedIds.forEach((id, i) => stmt.run((i + 1) * STEP, id, laneId));
  });
}
