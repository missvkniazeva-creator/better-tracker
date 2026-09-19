import type { DB } from '../db/index.ts';
import { newId } from '../db/index.ts';
import type { Label } from '../../../../shared/types.ts';

export function createLabel(d: DB, name: string, hue?: number | null): Label {
  const existing = d
    .prepare('SELECT id, name, hue, position FROM labels WHERE name = ?')
    .get(name) as unknown as Label | undefined;
  if (existing) return existing;

  const { m } = d.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM labels').get() as {
    m: number;
  };
  const label: Label = { id: newId('lbl'), name, hue: hue ?? null, position: m + 1000 };
  d.prepare('INSERT INTO labels (id, name, hue, position) VALUES (?, ?, ?, ?)').run(
    label.id,
    label.name,
    label.hue,
    label.position,
  );
  return label;
}

export function updateLabel(
  d: DB,
  id: string,
  patch: { name?: string; hue?: number | null },
): void {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.name !== undefined) (sets.push('name = ?'), args.push(patch.name));
  // hue is nullable on purpose: null resets the label to its name-derived colour.
  if (patch.hue !== undefined) (sets.push('hue = ?'), args.push(patch.hue));
  if (!sets.length) return;
  args.push(id);
  d.prepare(`UPDATE labels SET ${sets.join(', ')} WHERE id = ?`).run(...args);
}

export function deleteLabel(d: DB, id: string): void {
  d.prepare('DELETE FROM labels WHERE id = ?').run(id);
}
