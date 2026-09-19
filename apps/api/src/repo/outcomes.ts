import type { DB } from '../db/index.ts';
import { newId, tx } from '../db/index.ts';
import { readOutcomes } from './board.ts';
import type { Outcome } from '../../../../shared/types.ts';

const STEP = 1000;

export interface OutcomeInput {
  name?: string;
  description?: string;
  date?: string;
}

export function createOutcome(d: DB, input: OutcomeInput): Outcome {
  return tx(d, () => {
    const id = newId('out');
    const { m } = d.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM outcomes').get() as {
      m: number;
    };
    d.prepare(
      'INSERT INTO outcomes (id, name, description, date, position) VALUES (?, ?, ?, ?, ?)',
    ).run(id, input.name ?? 'New outcome', input.description ?? '', input.date ?? '', m + STEP);
    return readOutcomes(d).find((o) => o.id === id)!;
  });
}

export function updateOutcome(d: DB, id: string, patch: OutcomeInput): void {
  tx(d, () => {
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    if (patch.name !== undefined) (sets.push('name = ?'), args.push(patch.name));
    if (patch.description !== undefined)
      (sets.push('description = ?'), args.push(patch.description));
    if (patch.date !== undefined) (sets.push('date = ?'), args.push(patch.date));
    if (sets.length) {
      sets.push("updated_at = datetime('now')");
      args.push(id);
      d.prepare(`UPDATE outcomes SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    }
  });
}

export function deleteOutcome(d: DB, id: string): void {
  d.prepare('DELETE FROM outcomes WHERE id = ?').run(id);
}
