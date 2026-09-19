import type { DB } from './index.ts';
import { newId, tx } from './index.ts';

/**
 * First-run content: the Intake canvas (which always exists) and one Continuous lane.
 * No tasks, objectives or outcomes. Project lanes are the user's to name, so seeding
 * invented ones just means deleting them first.
 *
 * `npm run seed:demo` loads the prototype's demo content when a populated board is
 * wanted; it creates the lanes it needs.
 */
const DEFAULT_LANES = [
  {
    name: 'Continuous',
    color: 'lane3',
    cols: ['Now', 'Soon', 'Later'],
  },
] as const;

const DEFAULT_LABELS = ['ai', 'infra', 'docs', 'eval', 'security'];

export function bootstrap(d: DB): void {
  const { n } = d.prepare('SELECT COUNT(*) AS n FROM lanes').get() as { n: number };
  if (n > 0) return;

  tx(d, () => {
    const lane = d.prepare(
      'INSERT INTO lanes (id, name, hint, color, position) VALUES (?, ?, ?, ?, ?)',
    );
    const col = d.prepare(
      'INSERT INTO columns (id, lane_id, name, position) VALUES (?, ?, ?, ?)',
    );
    const label = d.prepare('INSERT INTO labels (id, name, position) VALUES (?, ?, ?)');

    DEFAULT_LANES.forEach((l, i) => {
      const laneId = newId('lane');
      lane.run(laneId, l.name, '', l.color, (i + 1) * 1000);
      l.cols.forEach((c, j) => col.run(newId('col'), laneId, c, (j + 1) * 1000));
    });
    DEFAULT_LABELS.forEach((name, i) => label.run(newId('lbl'), name, (i + 1) * 1000));
  });
}
