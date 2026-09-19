import { useMemo, useState } from 'react';
import { useBoard } from '../state/store.tsx';
import {
  LOG_SCOPES,
  addDaysIso,
  isoOf,
  logPeriodLabel,
  logRange,
  parseIso,
  shiftAnchor,
  shortDate,
  shortMonth,
  todayIso,
  weekStartIso,
  weekdayLabel,
  type LogScope,
} from '../lib/derive.ts';
import { renderInlineMarkdown } from '../lib/markdown.tsx';
import { MenuButton } from './MenuButton.tsx';
import { TokensPane } from './TokensPane.tsx';
import { MoreIcon } from './icons.tsx';
import type { BoardSnapshot, LogEntry, LogType, Task } from '@shared/types.ts';

/** A tool from the Log's tools menu, opened in the pane beside the list. */
export type LogTool = 'cards' | 'tokens';

// What moved, then what came out of it.
const TOOLS: { id: LogTool; label: string }[] = [
  { id: 'cards', label: 'Cards with activity' },
  { id: 'tokens', label: 'Artefacts & Values' },
];

/** Type colours are fixed by the handoff; they are the legend the bar reads against. */
const TYPE_COLOR: Record<LogType, string> = {
  Focus: 'var(--ink)',
  Meeting: 'var(--accent)',
  Call: 'var(--lane2)',
  Multitasking: 'var(--warn)',
};

const TYPE_ORDER: LogType[] = ['Focus', 'Meeting', 'Call', 'Multitasking'];

interface FlatEntry extends LogEntry {
  taskTitle: string;
}

/** Where drilling into a bucket lands. Day is the floor — it lists entries already. */
const DRILL_INTO: Record<LogScope, LogScope> = {
  Year: 'Month',
  Month: 'Week',
  Week: 'Day',
  Day: 'Day',
};

/**
 * Log panel: the whole board's activity, scoped to a period, and what it produced.
 *
 * Year and Month are *summaries* — a row per month or per week, each a proportional
 * bar you click to drill in. Week and Day are the readable end: entries themselves,
 * grouped under a day header. That split is the panel's whole idea, so the scope
 * control doubles as a zoom.
 *
 * Other readings of the same period — the cards worked on, the artefacts and values
 * produced, a report later — are tools, kept out of the list and opened from the
 * header's menu into a pane beside it. The pane follows the scope and period controls,
 * so it works in every scope.
 *
 * The range is a period, never "the last N days": comparing this September against
 * last September only works if both are whole months.
 */
export function LogPanel({
  tool,
  onTool,
  onOpenTask,
  onClose,
}: {
  /** The open tool, lifted so the side panel can widen for its pane. */
  tool: LogTool | null;
  onTool: (tool: LogTool | null) => void;
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}) {
  const { board } = useBoard();
  const [scope, setScope] = useState<LogScope>('Month');
  const [anchor, setAnchor] = useState(todayIso());

  const entries = useMemo(() => flatten(board), [board]);
  const range = logRange(scope, anchor);
  const inRange = entries.filter((e) => e.date >= range.from && e.date <= range.to);

  const hours = sumHours(inRange);
  const contributions = inRange.filter((e) => e.outcomeIds.length > 0).length;
  // Distinct, not a running total: naming the same artefact on four entries is one
  // artefact worked on four times, and counting it four times overstates the output.
  const artefacts = new Set(inRange.flatMap((e) => e.artefacts));
  const values = new Set(inRange.flatMap((e) => e.values));
  const types = TYPE_ORDER.map((name) => ({
    name,
    count: inRange.filter((e) => e.type === name).length,
  })).filter((t) => t.count > 0);

  const buckets = useMemo(
    () => (scope === 'Year' || scope === 'Month' ? bucketsFor(scope, anchor, entries) : []),
    [scope, anchor, entries],
  );
  const days = scope === 'Week' || scope === 'Day' ? daysFor(range, inRange) : [];
  const busiest = Math.max(1, ...buckets.map((b) => b.count));
  const outcomeName = (id: string) => board?.outcomes.find((o) => o.id === id)?.name ?? id;

  return (
    <>
      <div className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__rule" aria-hidden="true" />
            <h2 className="panel__title">Log</h2>
          </div>
          <div className="panel__actions">
            <MenuButton
              label="Tools"
              icon={<MoreIcon size={14} />}
              items={TOOLS.map((t) => ({
                id: t.id,
                label: t.label,
                checked: tool === t.id,
                // Picking the open tool again closes it, as the activity bar does.
                onSelect: () => onTool(tool === t.id ? null : t.id),
              }))}
            />
            <button
              type="button"
              className="panel__button"
              aria-label="Collapse Log"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="log-scope">
          <div className="log-scope__segs" role="group" aria-label="Scope">
            {LOG_SCOPES.map((option) => (
              <button
                key={option}
                type="button"
                data-active={scope === option || undefined}
                aria-pressed={scope === option}
                onClick={() => setScope(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="log-scope__step">
            <button type="button" className="panel__button" onClick={() => setAnchor(todayIso())}>
              Today
            </button>
            <button
              type="button"
              className="panel__button"
              aria-label="Previous period"
              title="Previous period"
              onClick={() => setAnchor((a) => shiftAnchor(scope, a, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              className="panel__button"
              aria-label="Next period"
              title="Next period"
              onClick={() => setAnchor((a) => shiftAnchor(scope, a, 1))}
            >
              ›
            </button>
          </div>
        </div>

        <div className="log-summary">
          <span className="log-summary__label">{logPeriodLabel(scope, anchor)}</span>
          <div className="log-summary__metrics">
            <Metric value={String(inRange.length)} label="Entries" />
            <Metric value={hours.toFixed(1)} label="Hours" />
            <Metric value={String(contributions)} label="Contributions" accent />
            <Metric value={String(artefacts.size)} label="Artefacts" />
            <Metric value={String(values.size)} label="Values" />
          </div>

          <div className="log-types" aria-hidden="true">
            {types.map((t) => (
              <span
                key={t.name}
                style={{
                  width: `${(t.count / inRange.length) * 100}%`,
                  background: TYPE_COLOR[t.name],
                }}
              />
            ))}
          </div>
          <div className="log-legend">
            {types.map((t) => (
              <span key={t.name} className="log-legend__item">
                <span className="log-legend__swatch" style={{ background: TYPE_COLOR[t.name] }} />
                {t.name} <span className="mono">{t.count}</span>
              </span>
            ))}
          </div>

          {/*
            No chip list of the period's artefacts and values here: over a year or a
            month it runs to hundreds and buries the summary. The counts above say how
            much, Week and Day show each one on its entry, and the Artefacts & Values
            tool lists the period's in full with its own filters.
          */}
        </div>

        <div className="panel__body">
          {buckets.map((bucket) => (
            <button
              key={bucket.goTo}
              type="button"
              className="log-bucket"
              data-empty={bucket.count === 0 || undefined}
              onClick={() => {
                setScope(DRILL_INTO[scope]);
                setAnchor(bucket.goTo);
              }}
            >
              <span className="log-bucket__label">{bucket.label}</span>
              <span className="log-bucket__bar" aria-hidden="true">
                <span style={{ width: `${(bucket.count / busiest) * 100}%` }} />
              </span>
              <span className="log-bucket__count mono">
                {bucket.count ? `${bucket.count} entries` : '—'}
              </span>
              <span className="log-bucket__hours mono">
                {bucket.hours ? `${bucket.hours.toFixed(1)}h` : ''}
              </span>
              <span className="log-bucket__chevron" aria-hidden="true">
                ›
              </span>
            </button>
          ))}

          {days.map((day) => (
            <section key={day.iso}>
              <div className="log-day">
                <span className="log-day__label">{weekdayLabel(day.iso)}</span>
                <span className="log-day__summary mono">
                  {day.entries.length} · {sumHours(day.entries).toFixed(1)}h
                </span>
              </div>
              {day.entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="log-entry"
                  title="Open task"
                  onClick={() => onOpenTask(entry.taskId)}
                >
                  <span className="log-entry__head">
                    <span className="log-entry__type" style={{ color: TYPE_COLOR[entry.type] }}>
                      {entry.type}
                    </span>
                    <span className="log-entry__task">{entry.taskTitle}</span>
                    <span className="log-entry__hours mono">
                      {entry.hours ? `${entry.hours}h` : ''}
                    </span>
                  </span>
                  <span className="log-entry__note">{renderInlineMarkdown(entry.note)}</span>
                  {(entry.outcomeIds.length > 0 ||
                    entry.artefacts.length > 0 ||
                    entry.values.length > 0) && (
                    <span className="log-entry__outcomes">
                      {entry.outcomeIds.map((id) => (
                        <span key={id} className="token token--outcome">
                          → {outcomeName(id)}
                        </span>
                      ))}
                      {entry.artefacts.map((a) => (
                        <span key={a} className="token token--artefact">
                          <span className="token__kind">Artefact</span>
                          {a}
                        </span>
                      ))}
                      {entry.values.map((v) => (
                        <span key={v} className="token token--value">
                          <span className="token__kind">Value</span>
                          {v}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </section>
          ))}

          {buckets.length === 0 && days.length === 0 && (
            <p className="panel__empty">No activity in this period.</p>
          )}
        </div>
      </div>
      {tool === 'cards' && (
        <CardsPane
          period={logPeriodLabel(scope, anchor)}
          cards={cardsWithActivity(board, range)}
          onOpenTask={onOpenTask}
          onClose={() => onTool(null)}
        />
      )}
      {tool === 'tokens' && (
        <TokensPane
          period={logPeriodLabel(scope, anchor)}
          range={range}
          onOpenTask={onOpenTask}
          onClose={() => onTool(null)}
        />
      )}
    </>
  );
}

function Metric({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="log-metric">
      <span className="log-metric__value mono" data-accent={accent || undefined}>
        {value}
      </span>
      <span className="log-metric__label">{label}</span>
    </div>
  );
}

/**
 * Cards with activity: what moved in the period, busiest first — the spine of a weekly
 * report. It reads the Log's own scope and period, so stepping to another week re-reads
 * it rather than leaving last week's cards beside this week's timeline.
 */
function CardsPane({
  period,
  cards,
  onOpenTask,
  onClose,
}: {
  period: string;
  cards: CardActivity[];
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}) {
  const hours = sumHours(cards.flatMap((c) => c.entries));
  return (
    <section className="editor" aria-label="Cards with activity">
      <header className="editor__header">
        <div className="log-pane__heading">
          <h3 className="editor__title">Cards with activity</h3>
          <span className="log-pane__meta">
            {period} · <span className="mono">{cards.length}</span>{' '}
            {cards.length === 1 ? 'card' : 'cards'} ·{' '}
            <span className="mono">{hours.toFixed(1)}h</span>
          </span>
        </div>
        <button
          type="button"
          className="panel__button"
          aria-label="Close cards with activity"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="log-pane__body">
        {cards.map((card) => (
          <button
            key={card.task.id}
            type="button"
            className="log-card"
            title="Open this card"
            onClick={() => onOpenTask(card.task.id)}
          >
            <span className="log-card__title">
              {card.task.title || 'Untitled card'}
              {card.task.archived && <span className="log-card__archived">archived</span>}
            </span>
            <span className="log-card__hours mono">{sumHours(card.entries).toFixed(1)}h</span>
            <span className="log-card__meta">
              {card.lane} · <span className="mono">{card.entries.length}</span>{' '}
              {card.entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </button>
        ))}
        {cards.length === 0 && (
          <p className="panel__empty">No cards were worked on in this period.</p>
        )}
      </div>
    </section>
  );
}

/** Every entry on the board, carrying the title of the card it belongs to. */
function flatten(board: BoardSnapshot | null): FlatEntry[] {
  if (!board) return [];
  return board.tasks.flatMap((task) =>
    task.log.map((entry) => ({ ...entry, taskTitle: task.title })),
  );
}

function sumHours(entries: LogEntry[]): number {
  return entries.reduce((total, entry) => total + entry.hours, 0);
}

interface CardActivity {
  task: Task;
  entries: LogEntry[];
  /** Resolved here, where the board is already in hand. "Intake" if never filed. */
  lane: string;
}

/**
 * The cards that were worked on in the period, busiest first.
 *
 * Archived cards are deliberately included — `board.tasks` carries them and nothing
 * filters them out. A card archived on Thursday still absorbed Monday's hours, and a
 * report that silently drops it cannot be reconciled against the period's totals.
 */
function cardsWithActivity(
  board: BoardSnapshot | null,
  range: { from: string; to: string },
): CardActivity[] {
  if (!board) return [];
  return board.tasks
    .map((task) => ({
      task,
      entries: task.log.filter((e) => e.date >= range.from && e.date <= range.to),
      lane: board.lanes.find((l) => l.id === task.laneId)?.name ?? 'Intake',
    }))
    .filter((card) => card.entries.length > 0)
    .sort(
      (a, b) =>
        sumHours(b.entries) - sumHours(a.entries) ||
        b.entries.length - a.entries.length ||
        a.task.title.localeCompare(b.task.title),
    );
}


interface Bucket {
  label: string;
  count: number;
  hours: number;
  /** The anchor to jump to when this row is drilled into. */
  goTo: string;
}

/**
 * A Year's twelve months, or a Month's weeks. Empty buckets are kept: a month with no
 * activity is a fact about the year, and dropping it would misalign the twelve rows.
 */
function bucketsFor(scope: LogScope, anchor: string, entries: FlatEntry[]): Bucket[] {
  const at = parseIso(anchor) ?? new Date();
  const between = (from: string, to: string) =>
    entries.filter((e) => e.date >= from && e.date <= to);

  if (scope === 'Year') {
    const year = at.getFullYear();
    return Array.from({ length: 12 }, (_, month) => {
      const from = isoOf(new Date(year, month, 1));
      const to = isoOf(new Date(year, month + 1, 0));
      const found = between(from, to);
      return { label: shortMonth(month), count: found.length, hours: sumHours(found), goTo: from };
    });
  }

  const { from: monthStart, to: monthEnd } = logRange('Month', anchor);
  const out: Bucket[] = [];
  // Start on the Monday of the week the month opens in, so a week is never split.
  for (let week = weekStartIso(monthStart); week <= monthEnd; week = addDaysIso(week, 7)) {
    const end = addDaysIso(week, 6);
    const found = between(week, end);
    out.push({
      label: `${shortDate(week)} – ${shortDate(end)}`,
      count: found.length,
      hours: sumHours(found),
      goTo: week,
    });
  }
  return out;
}

/** Days that actually carry entries, oldest first. Blank days are simply absent. */
function daysFor(
  range: { from: string; to: string },
  inRange: FlatEntry[],
): { iso: string; entries: FlatEntry[] }[] {
  const out: { iso: string; entries: FlatEntry[] }[] = [];
  for (let day = range.from; day <= range.to; day = addDaysIso(day, 1)) {
    const entries = inRange.filter((e) => e.date === day);
    if (entries.length) out.push({ iso: day, entries });
  }
  return out;
}
