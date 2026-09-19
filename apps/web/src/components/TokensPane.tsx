import { useMemo, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import {
  EMPTY_TOKEN_FILTERS,
  NO_OUTCOME,
  matchesTokenFilters,
  objectiveTree,
  shortDate,
  tokenFilterCount,
  tokenList,
  type TokenFilters,
} from '../lib/derive.ts';
import { TargetIcon } from './icons.tsx';

/**
 * Artefacts & Values, a Log tool: what the period's work produced or was worth, in one
 * chronology, newest first, filterable by kind, outcome and objective.
 *
 * It reads the Log's scope and period rather than the whole board. The board-wide list
 * only ever grew, and the question it answers — what came out of this week, this month
 * — is the one the Log's period controls already ask. The filters survive stepping
 * between periods, so one outcome can be followed week by week.
 *
 * A flat list rather than groups: the filters do the narrowing and the date order is the
 * one thing that always holds. Rows are **occurrences**, not distinct names — naming the
 * same artefact on four entries is four days of work on it.
 *
 * Each row carries its card (click to open), the outcomes the *entry* was attributed
 * to, and the objectives its *card* serves, so a row explains where it came from
 * without being opened.
 */
export function TokensPane({
  period,
  range,
  onOpenTask,
  onClose,
}: {
  /** The Log's period label, e.g. "Sep 7 – Sep 13, 2026". */
  period: string;
  range: { from: string; to: string };
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}) {
  const { board } = useBoard();
  const [filters, setFilters] = useState<TokenFilters>(EMPTY_TOKEN_FILTERS);

  const all = useMemo(() => (board ? tokenList(board) : []), [board]);
  if (!board) return null;

  const rows = all.filter((row) => row.date >= range.from && row.date <= range.to);
  const shown = rows.filter((row) => matchesTokenFilters(row, filters));
  const active = tokenFilterCount(filters);
  const set = (patch: Partial<TokenFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <section className="editor" aria-label="Artefacts and values">
      <header className="editor__header">
        <div className="log-pane__heading">
          <h3 className="editor__title">Artefacts &amp; Values</h3>
          <span className="log-pane__meta">
            {/* While filtered, say what was filtered *out* rather than hiding it. */}
            {period} · <span className="mono">{shown.length}</span>
            {active > 0 && rows.length > 0 && (
              <>
                {' '}
                of <span className="mono">{rows.length}</span>
              </>
            )}{' '}
            {rows.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <button
          type="button"
          className="panel__button"
          aria-label="Close artefacts and values"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="tok-filters">
        <label className="tok-filter tok-filter--kind">
          <span className="rail-label">Kind</span>
          <select
            value={filters.kind}
            onChange={(e) => set({ kind: e.target.value as TokenFilters['kind'] })}
          >
            <option value="">Both</option>
            <option value="artefact">Artefacts</option>
            <option value="value">Values</option>
          </select>
        </label>

        <label className="tok-filter">
          <span className="rail-label">Outcome</span>
          <select value={filters.outcomeId} onChange={(e) => set({ outcomeId: e.target.value })}>
            <option value="">All</option>
            {board.outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.name}
              </option>
            ))}
            {/* "Empty", not "not attributed": the pane's select is too narrow for more. */}
            <option value={NO_OUTCOME}>— empty —</option>
          </select>
        </label>

        <label className="tok-filter">
          <span className="rail-label">Objective</span>
          {/*
            Tree order with an indent prefix, matching every other objective picker —
            a flat alphabetical list would lose the nesting that ranks them.
          */}
          <select
            value={filters.objectiveId}
            onChange={(e) => set({ objectiveId: e.target.value })}
          >
            <option value="">All</option>
            {objectiveTree(board.objectives).map(({ objective, level }) => (
              <option key={objective.id} value={objective.id}>
                {'— '.repeat(level)}
                {objective.name}
              </option>
            ))}
          </select>
        </label>

        {active > 0 && (
          <button
            type="button"
            className="mini-button"
            onClick={() => setFilters(EMPTY_TOKEN_FILTERS)}
          >
            Clear
          </button>
        )}
      </div>

      <div className="log-pane__body">
        {all.length === 0 && (
          <p className="panel__empty">
            Nothing logged yet. Add an <strong>!Artefact</strong> or{' '}
            <strong>+Value</strong> line to an activity entry.
          </p>
        )}
        {all.length > 0 && rows.length === 0 && (
          <p className="panel__empty">No artefacts or values were logged in this period.</p>
        )}
        {rows.length > 0 && shown.length === 0 && (
          <p className="panel__empty">Nothing in this period matches these filters.</p>
        )}

        {shown.map((row) => (
          <div key={row.key} className="tok-row">
            <span className="tok-row__date mono">{shortDate(row.date)}</span>
            <div className="tok-row__body">
              {/* The same chip the activity log uses, so a token looks the same
                  wherever it is read. */}
              <span className={`token token--${row.kind}`}>
                <span className="token__kind">{row.kind}</span>
                {row.name}
              </span>
              <div className="tok-row__meta">
                <button
                  type="button"
                  className="tok-row__task"
                  title="Open this card"
                  onClick={() => onOpenTask(row.taskId)}
                >
                  {row.taskTitle || 'Untitled card'}
                </button>
                {row.outcomes.map((outcome) => (
                  <span key={outcome.id} className="token token--outcome">
                    → {outcome.name}
                  </span>
                ))}
                {row.objectives.map((objective) => (
                  <span key={objective.id} className="tok-row__objective">
                    <TargetIcon size={11} />
                    {objective.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
