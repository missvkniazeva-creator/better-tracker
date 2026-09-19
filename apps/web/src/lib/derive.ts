import type {
  BoardSnapshot,
  Lane,
  Objective,
  Outcome,
  Task,
  TaskPhase,
} from '@shared/types.ts';

/**
 * Where a card sits within its *own* lane. Column names are user-editable, so the
 * phase is read from column order and never from a name: last column = staged,
 * first = pending, anything between = in action.
 */
export function taskPhase(task: Task, lane: Lane | undefined): TaskPhase {
  if (!task.columnId || !lane) return 'intake';
  const index = lane.columns.findIndex((c) => c.id === task.columnId);
  if (index < 0) return 'intake';
  if (index === lane.columns.length - 1) return 'staged';
  if (index === 0) return 'pending';
  return 'in-action';
}

/** Every descendant of an objective, by id. Roll-ups are family-inclusive. */
export function objectiveFamily(objectives: Objective[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const o of objectives) {
    if (!o.parentId) continue;
    childrenOf.set(o.parentId, [...(childrenOf.get(o.parentId) ?? []), o.id]);
  }
  const family = new Set<string>([id]);
  const queue = [id];
  while (queue.length) {
    for (const child of childrenOf.get(queue.pop()!) ?? []) {
      if (family.has(child)) continue;
      family.add(child);
      queue.push(child);
    }
  }
  return family;
}

export function objectiveLevel(objectives: Objective[], id: string): number {
  const byId = new Map(objectives.map((o) => [o.id, o]));
  let level = 0;
  let current = byId.get(id)?.parentId ?? null;
  while (current && level < 20) {
    level++;
    current = byId.get(current)?.parentId ?? null;
  }
  return level;
}

// ------------------------------------------------------------------- dates

/** Today as ISO yyyy-mm-dd, in local time (not UTC, which shifts the date). */
export function todayIso(): string {
  const now = new Date();
  return isoOf(now);
}

export function isoOf(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIso(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 5" — the handoff's display format for datelines and outcome dates. */
export function shortDate(iso: string): string {
  const d = parseIso(iso);
  return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : '';
}

/** ISO week number, for the header's "Wk 36" stamp. */
export function isoWeek(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Thursday of the current week decides the year the week belongs to.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

export function weekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 4); // working week, Mon–Fri, as in the handoff
  return { start, end };
}

/** "Wk 36 · Sep 1–5, 2026" */
export function weekStamp(date: Date): string {
  const { start, end } = weekRange(date);
  const sameMonth = start.getMonth() === end.getMonth();
  const tail = sameMonth
    ? `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
    : `${MONTHS[start.getMonth()]} ${start.getDate()}–${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `Wk ${isoWeek(date)} · ${tail}, ${end.getFullYear()}`;
}

/** A dateline is overdue when it has passed and the card is not yet staged. */
export function isOverdue(task: Task, lane: Lane | undefined, today: string): boolean {
  if (!task.dateline) return false;
  if (taskPhase(task, lane) === 'staged') return false;
  return task.dateline < today;
}

// ------------------------------------------------------------------ labels

/**
 * Label chips take their hue from a hash of the name, so a label keeps its colour
 * without anyone choosing one and two labels never collide by accident.
 */
export function labelHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

/** A label's hue: the one chosen in the editor, else derived from its name. */
export function labelColor(label: { name: string; hue: number | null }): number {
  return label.hue ?? labelHue(label.name);
}

// ------------------------------------------------------------------ search

export interface Filters {
  search: string;
  labelIds: Set<string>;
  priorities: Set<string>;
  objectiveIds: Set<string>;
  obstaclesOnly: boolean;
  highSeverityOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  labelIds: new Set(),
  priorities: new Set(),
  objectiveIds: new Set(),
  obstaclesOnly: false,
  highSeverityOnly: false,
};

export function filterCount(f: Filters): number {
  return (
    f.labelIds.size +
    f.priorities.size +
    f.objectiveIds.size +
    (f.obstaclesOnly ? 1 : 0) +
    (f.highSeverityOnly ? 1 : 0)
  );
}

/**
 * Filter groups are AND-ed with each other and OR-ed within themselves: picking
 * two labels widens, adding a priority narrows. Objective matching is
 * family-inclusive, so filtering by a parent shows the whole branch's cards.
 */
export function matchesFilters(task: Task, filters: Filters, board: BoardSnapshot): boolean {
  if (task.archived) return false;

  if (filters.labelIds.size && !task.labelIds.some((id) => filters.labelIds.has(id))) return false;
  if (filters.priorities.size && !filters.priorities.has(task.priority)) return false;
  if (filters.obstaclesOnly && !task.obstacles.trim()) return false;
  if (filters.highSeverityOnly && task.severity !== 'High') return false;

  if (filters.objectiveIds.size) {
    const wanted = new Set<string>();
    for (const id of filters.objectiveIds) {
      for (const member of objectiveFamily(board.objectives, id)) wanted.add(member);
    }
    if (!task.objectiveIds.some((id) => wanted.has(id))) return false;
  }

  const q = filters.search.trim().toLowerCase();
  if (q) {
    const haystack = [
      task.title,
      task.description,
      task.obstacles,
      ...task.log.map((e) => e.note),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

// -------------------------------------------------------------- objectives

export interface ObjectiveRow {
  objective: Objective;
  /** Nesting depth. Indentation carries it; there is no label for a level. */
  level: number;
  year: number;
}

/**
 * The objective tree, depth-first, archived ones omitted. A child inherits its
 * root's year so a family never splits across two year groups.
 */
export function objectiveTree(objectives: Objective[]): ObjectiveRow[] {
  const live = objectives.filter((o) => !o.archived);
  const rows: ObjectiveRow[] = [];
  const fallbackYear = new Date().getFullYear();

  const walk = (parentId: string | null, level: number, rootYear: number) => {
    for (const objective of live.filter((o) => (o.parentId ?? null) === parentId)) {
      const year = level === 0 ? objective.year || fallbackYear : rootYear;
      rows.push({ objective, level, year });
      walk(objective.id, level + 1, year);
    }
  };
  walk(null, 0, fallbackYear);
  return rows;
}

export interface HeatCell {
  /** The day this cell counts, ISO yyyy-mm-dd. */
  iso: string;
  count: number;
  label: string;
}

/**
 * The activity map is a single row of consecutive days, oldest at the left and today
 * at the right edge. One row keeps each objective and outcome compact, and recent days
 * are what the map is read for.
 *
 * Both panels render the same map, so the shape of one objective's activity and one
 * outcome's activity are directly comparable.
 */
const ACTIVITY_MAP_DAYS = 30;

export function dayHeat(entries: { date: string }[], today = new Date()): HeatCell[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);

  const cells: HeatCell[] = [];
  for (let back = ACTIVITY_MAP_DAYS - 1; back >= 0; back--) {
    const day = new Date(today);
    day.setDate(day.getDate() - back);
    const iso = isoOf(day);
    const count = counts.get(iso) ?? 0;
    cells.push({
      iso,
      count,
      label: `${shortDate(iso)}: ${count} ${count === 1 ? 'entry' : 'entries'}`,
    });
  }
  return cells;
}

export interface ObjectiveStats {
  contributions: number;
  outcomes: Outcome[];
  heat: HeatCell[];
}

/**
 * Roll-up for one objective, over the cards that name **this** objective and no
 * others.
 *
 * Nothing propagates up the tree. A parent used to inherit every descendant's
 * contributions, which made the top of the tree look busy while nothing was linked to
 * it: an objective with no cards of its own read as the most active thing on the
 * board. What an objective has actually attracted is what its own cards logged.
 *
 * `outcomes` is derived the same way — the outcomes those cards feed. There is no
 * stored objective→outcome link any more; the two meet on a card or not at all.
 *
 * There is deliberately no card count here. The header already counts cards, against
 * the active filters, and a second unfiltered count beside it only ever disagreed.
 */
export function objectiveStats(
  board: BoardSnapshot,
  objectiveId: string,
  today = new Date(),
): ObjectiveStats {
  const cards = board.tasks.filter((t) => t.objectiveIds.includes(objectiveId));
  const reached = new Set(cards.flatMap((t) => t.outcomeIds));

  return {
    contributions: cards.flatMap((t) => t.log).length,
    outcomes: board.outcomes.filter((o) => reached.has(o.id)),
    heat: dayHeat(cards.flatMap((t) => t.log), today),
  };
}

export interface OutcomeStats {
  contributions: number;
  heat: HeatCell[];
}

/**
 * Roll-up for one outcome, counted over *attributed* log entries rather than linked
 * cards: an outcome is a result, and what moves it is the work booked against it.
 */
export function outcomeStats(
  board: BoardSnapshot,
  outcomeId: string,
  today = new Date(),
): OutcomeStats {
  const entries = board.tasks
    .flatMap((t) => t.log)
    .filter((e) => e.outcomeIds.includes(outcomeId));
  return { contributions: entries.length, heat: dayHeat(entries, today) };
}

/** Heat cell fill: empty days read as a rule, busier days deepen toward accent. */
export function heatColor(count: number): string {
  if (count === 0) return 'var(--line)';
  return `color-mix(in srgb, var(--accent) ${Math.min(100, 30 + count * 22)}%, var(--surf))`;
}

// --------------------------------------------------------------- log scopes

export type LogScope = 'Year' | 'Month' | 'Week' | 'Day';

export const LOG_SCOPES: LogScope[] = ['Year', 'Month', 'Week', 'Day'];

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

/** The Monday on or before `iso`. */
export function weekStartIso(iso: string): string {
  const d = parseIso(iso) ?? new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
}

/** "Monday, Sep 7" — the log panel's day header. */
export function weekdayLabel(iso: string): string {
  const d = parseIso(iso);
  return d ? `${WEEKDAYS[d.getDay()]}, ${shortDate(iso)}` : '';
}

export function monthName(month: number): string {
  return MONTH_NAMES[month] ?? '';
}

export function shortMonth(month: number): string {
  return MONTHS[month] ?? '';
}

/** The inclusive ISO day range one scope covers around its anchor. */
export function logRange(scope: LogScope, anchor: string): { from: string; to: string } {
  if (scope === 'Day') return { from: anchor, to: anchor };
  if (scope === 'Week') {
    const from = weekStartIso(anchor);
    return { from, to: addDaysIso(from, 6) };
  }
  const d = parseIso(anchor) ?? new Date();
  if (scope === 'Month') {
    return {
      from: isoOf(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }
  return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
}

/** Step the anchor one whole period in `direction`, keeping the scope. */
export function shiftAnchor(scope: LogScope, anchor: string, direction: number): string {
  const d = parseIso(anchor) ?? new Date();
  if (scope === 'Day') return addDaysIso(anchor, direction);
  if (scope === 'Week') return addDaysIso(weekStartIso(anchor), direction * 7);
  if (scope === 'Month') return isoOf(new Date(d.getFullYear(), d.getMonth() + direction, 1));
  return isoOf(new Date(d.getFullYear() + direction, 0, 1));
}

/** The heading over the summary block: "2026", "September 2026", "Sep 7 – Sep 13, 2026". */
export function logPeriodLabel(scope: LogScope, anchor: string): string {
  const d = parseIso(anchor) ?? new Date();
  const year = d.getFullYear();
  if (scope === 'Year') return String(year);
  if (scope === 'Month') return `${monthName(d.getMonth())} ${year}`;
  if (scope === 'Week') {
    const { from, to } = logRange('Week', anchor);
    return `${shortDate(from)} – ${shortDate(to)}, ${year}`;
  }
  return `${weekdayLabel(anchor)}, ${year}`;
}

// ------------------------------------------------- artefacts and values

export type TokenKind = 'artefact' | 'value';

export interface TokenEntry {
  /** Stable per occurrence — one log entry can name several tokens. */
  key: string;
  kind: TokenKind;
  /** The artefact or value text, exactly as it was logged. */
  name: string;
  /** ISO date of the entry that named it. */
  date: string;
  taskId: string;
  taskTitle: string;
  /** What the *entry* was attributed to. Empty when nobody attributed it. */
  outcomes: Outcome[];
  /** What the *card* serves. A token inherits its card's objectives. */
  objectives: Objective[];
}

export interface TokenFilters {
  /** '' for both kinds. */
  kind: TokenKind | '';
  outcomeId: string;
  objectiveId: string;
}

export const EMPTY_TOKEN_FILTERS: TokenFilters = { kind: '', outcomeId: '', objectiveId: '' };

/**
 * Everything the work has produced or been worth, one row per occurrence, newest
 * first — artefacts and values in one sequence rather than two lists.
 *
 * They belong together: a single log entry usually names both, one being the thing
 * made and the other what it was worth, and splitting them put two halves of the same
 * moment on two screens. The chip carries the kind, so nothing is lost by interleaving.
 *
 * Occurrences rather than distinct names: naming the same artefact on four entries is
 * four days of work on it, and collapsing that to one row with a count throws away the
 * chronology the list is ordered by. The filters are what keep it readable.
 *
 * Outcomes come from the entry — that is where attribution is recorded — while
 * objectives come from the card, since a card is what commits work to an objective.
 */
export function tokenList(board: BoardSnapshot): TokenEntry[] {
  const outcomeById = new Map(board.outcomes.map((o) => [o.id, o]));
  const objectiveById = new Map(board.objectives.map((o) => [o.id, o]));
  const rows: TokenEntry[] = [];

  for (const task of board.tasks) {
    const objectives = task.objectiveIds
      .map((id) => objectiveById.get(id))
      .filter((o): o is Objective => Boolean(o));

    for (const entry of task.log) {
      const outcomes = entry.outcomeIds
        .map((id) => outcomeById.get(id))
        .filter((o): o is Outcome => Boolean(o));

      const push = (kind: TokenKind, name: string) =>
        rows.push({
          key: `${entry.id}:${kind}:${name}`,
          kind,
          name,
          date: entry.date,
          taskId: task.id,
          taskTitle: task.title,
          outcomes,
          objectives,
        });

      // Artefact before value within one entry: the thing made, then what it was worth.
      for (const name of entry.artefacts) push('artefact', name);
      for (const name of entry.values) push('value', name);
    }
  }

  // Newest first, and stable within a day so two entries on one date keep board order.
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Sentinel for "not attributed to any outcome", used by the token list's filter. */
export const NO_OUTCOME = '\u0000none';

export function matchesTokenFilters(row: TokenEntry, filters: TokenFilters): boolean {
  if (filters.kind && row.kind !== filters.kind) return false;

  if (filters.outcomeId === NO_OUTCOME) {
    if (row.outcomes.length) return false;
  } else if (filters.outcomeId && !row.outcomes.some((o) => o.id === filters.outcomeId)) {
    return false;
  }

  if (filters.objectiveId && !row.objectives.some((o) => o.id === filters.objectiveId)) {
    return false;
  }
  return true;
}

export function tokenFilterCount(f: TokenFilters): number {
  return (f.kind ? 1 : 0) + (f.outcomeId ? 1 : 0) + (f.objectiveId ? 1 : 0);
}
