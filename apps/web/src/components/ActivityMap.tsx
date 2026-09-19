import { heatColor, type HeatCell } from '../lib/derive.ts';

/**
 * The activity map shared by the Objectives and Outcomes panels: one cell per day in a
 * single row, so the rightmost cell is always today.
 *
 * Both panels use it unchanged. The point of the map is comparison — an objective's
 * rhythm read against an outcome's — which only holds while the granularity, the
 * span and the colour ramp are identical.
 */
export function ActivityMap({ cells }: { cells: HeatCell[] }) {
  return (
    <div className="heat" role="img" aria-label={`Activity over the last ${cells.length} days`}>
      {cells.map((cell) => (
        <span
          key={cell.iso}
          className="heat__cell"
          title={cell.label}
          style={{ background: heatColor(cell.count) }}
        />
      ))}
    </div>
  );
}
