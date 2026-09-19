import type { DB } from '../db/index.ts';
import { newId, tx } from '../db/index.ts';
import { readObjectives } from './board.ts';
import { BadRequest } from '../errors.ts';
import type { Objective } from '../../../../shared/types.ts';

const STEP = 1000;

export interface ObjectiveInput {
  name?: string;
  parentId?: string | null;
  measure?: string;
  year?: number;
}

export function createObjective(d: DB, input: ObjectiveInput): Objective {
  return tx(d, () => {
    const id = newId('obj');
    const { m } = d.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM objectives').get() as {
      m: number;
    };
    const parentId = input.parentId ?? null;
    d.prepare(
      'INSERT INTO objectives (id, parent_id, name, measure, year, position) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      parentId,
      input.name ?? 'New objective',
      input.measure ?? '',
      input.year ?? rootYear(d, parentId) ?? new Date().getFullYear(),
      m + STEP,
    );
    return readObjectives(d).find((o) => o.id === id)!;
  });
}

export function updateObjective(d: DB, id: string, patch: ObjectiveInput): void {
  tx(d, () => {
    if (patch.parentId !== undefined && wouldCycle(d, id, patch.parentId)) {
      throw new BadRequest('an objective cannot be moved under its own descendant');
    }
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    if (patch.name !== undefined) (sets.push('name = ?'), args.push(patch.name));
    if (patch.measure !== undefined) (sets.push('measure = ?'), args.push(patch.measure));
    if (patch.parentId !== undefined) (sets.push('parent_id = ?'), args.push(patch.parentId));
    if (patch.year !== undefined) (sets.push('year = ?'), args.push(patch.year));
    if (!sets.length) return;
    sets.push("updated_at = datetime('now')");
    args.push(id);
    d.prepare(`UPDATE objectives SET ${sets.join(', ')} WHERE id = ?`).run(...args);

    // Children inherit their root's year, so a reparent has to carry the subtree.
    if (patch.parentId !== undefined || patch.year !== undefined) {
      const year = rootYear(d, id);
      if (year !== null) {
        for (const child of descendants(d, id)) {
          d.prepare('UPDATE objectives SET year = ? WHERE id = ?').run(year, child);
        }
      }
    }
  });
}

/**
 * Archive, per the handoff: the objective is hidden and its children are promoted
 * to its former parent, so the tree never gains an orphan. Task references are
 * left alone -- an archived objective still explains why old cards existed.
 */
export function archiveObjective(d: DB, id: string): void {
  tx(d, () => {
    const row = d.prepare('SELECT parent_id FROM objectives WHERE id = ?').get(id) as
      | { parent_id: string | null }
      | undefined;
    if (!row) return;
    d.prepare('UPDATE objectives SET parent_id = ? WHERE parent_id = ?').run(row.parent_id, id);
    d.prepare("UPDATE objectives SET archived = 1, updated_at = datetime('now') WHERE id = ?").run(
      id,
    );
  });
}

export function unarchiveObjective(d: DB, id: string): void {
  d.prepare("UPDATE objectives SET archived = 0, updated_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteObjective(d: DB, id: string): void {
  // Children are promoted first; ON DELETE SET NULL would otherwise strand them
  // at the root of the tree.
  archiveObjective(d, id);
  d.prepare('DELETE FROM objectives WHERE id = ?').run(id);
}

/** Every descendant id of `id`, excluding `id` itself. */
export function descendants(d: DB, id: string): string[] {
  const rows = d
    .prepare(
      `WITH RECURSIVE family(id) AS (
         SELECT id FROM objectives WHERE parent_id = ?
         UNION ALL
         SELECT o.id FROM objectives o JOIN family f ON o.parent_id = f.id
       ) SELECT id FROM family`,
    )
    .all(id) as { id: string }[];
  return rows.map((r) => r.id);
}

function rootYear(d: DB, id: string | null): number | null {
  let current = id;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const row = d.prepare('SELECT parent_id, year FROM objectives WHERE id = ?').get(current) as
      | { parent_id: string | null; year: number }
      | undefined;
    if (!row) return null;
    if (!row.parent_id) return row.year;
    current = row.parent_id;
  }
  return null;
}

function wouldCycle(d: DB, id: string, parentId: string | null): boolean {
  if (!parentId) return false;
  if (parentId === id) return true;
  return descendants(d, id).includes(parentId);
}
