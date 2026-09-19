# Implementation plan

Source of truth: `docs/design-handoff/handoff.md` plus `prototype.dc.html`. The plan
below covers the whole design surface; phases 1 and 2 are built.

## Decisions taken at setup

| Decision | Choice | Why |
|---|---|---|
| Runtime | Vite SPA + Fastify API, one `npm run up` | HMR for a dense UI; one port in production |
| Persistence | SQLite via `node:sqlite` | In Node core — no native module, no build step |
| Styling | Plain CSS with custom properties | The handoff's tokens, `color-mix()` and `oklch()` are already a design system |
| First run | Intake + one Continuous lane, no cards | Project lanes are the user's to name; `npm run seed:demo` for a full board |
| Local LLM | Not built | Reporting requirements unspecified; a stub now would be a guess |
| Relations | By id, not by name | The handoff's own recommendation; kills the rename cascade |

---

## Phase 1 — Foundation ✅

- Workspace, `.gitignore`, scripts, repo-local memory in `.claude/memory/`.
- SQLite schema (15 tables) with `PRAGMA user_version` migrations, WAL, foreign keys on.
- Repo layer: board snapshot, lanes/columns, tasks, images, log, objectives, outcomes,
  labels, settings.
- REST API, loopback-bound, every mutation returning the full snapshot. JSON export.
- `db:reset` and `seed:demo` CLIs; 10 repo-layer tests.
- Design tokens for both themes; base stylesheet; typed API client; board store.

## Phase 2 — Board ✅

- Header: wordmark, live week stamp, search, theme toggle, filter toggle with count.
- Filters bar: labels as pills, priority and flags carrying the cards' own glyphs
  **in the cards' colours** (P1 danger, P2 warn, P3 ink3, obstacle and severity
  danger; an active chip inverts, where those hues have no contrast), and objectives
  on their own line —
  multiselect, AND across groups, objective matching family-inclusive, result count in
  `aria-live`. **Edit** turns the labels group into rename-in-place fields with a ×
  each, a colour swatch opening a 12-hue palette with an **Auto** reset, and a dashed
  "New label ↵" field, toggled by a pencil/check icon like the log rows; this is the only view showing every label at once, so managing
  them belongs here. A label's `hue` is nullable — null derives the colour from the
  name, which is what every label did before colours could be picked.
- Intake: absolute placement at stored x/y, double-click to create, drag within and out,
  drag handle resize (96–2400px) persisted to settings.
- Lanes: colour-tinted headers, inline rename with the seven-swatch picker, collapse,
  drag-reorder with the inset ink rule, add column, delete.
- Columns: collapse to a 34px strip, per-column drop zones. No add button —
  double-clicking the empty space below the cards creates one, the gesture the Intake
  canvas already uses.
- Cards, per the prototype's markup: title left with severity / obstacle / priority
  marks top-right, a labels row, and a footer band listing linked objectives and
  outcomes. An obstacle shows as the warning glyph only — the card is not tinted, so
  severity and overdue still stand out on a blocked card. **P2 carries no priority glyph** — it is the default, and marking every
  card would leave nothing standing out. The dateline shows as the left edge stroke
  (danger overdue, ink3 ahead, line2 none) rather than as text, and the log-entry
  count is not on the card face; both match the prototype, though `handoff.md`'s
  written "meta row" paragraph still describes the older single-row layout.
- Delete-lane dialog with merge-by-column-name.
- Activity bar and docked panel shell; the board reflows beside it.

**Verified:** 18 demo cards render in both themes, no console errors, `npm test` and
`npm run typecheck` clean.

---

## Phase 3 — Card modal ✅

- Opens by clicking a card, and on creation — a new card is created empty with its
  modal focused on the title, rather than appearing untitled on the board.
- Lane picker plus a segmented state control built from that lane's own columns. The
  picker exists so a card can be filed without dragging; the handoff's accessibility
  notes ask for keyboard equivalents to every drag.
- Description and Obstacles as Write/Preview pairs over a markdown subset (bold,
  italic, code, links, images, bullet **and numbered** lists, headings).
  Double-clicking the rendered text switches to Write with the caret in it. Rendered to React nodes, not an HTML
  string, so note text cannot inject markup and `javascript:` hrefs degrade to text.
- Image paste: reads the clipboard file, posts the bytes, inserts `![name](id)` at the
  caret, and shows a 64×48 thumbnail strip whose × removes both image and reference.
- Priority (ordered low → high, matching severity beside it), severity, dateline,
  tag-style labels — chips you can remove plus one input that both searches the
  existing set and creates new ones — objectives and outcomes.
- **Copy**: a button in the modal header, or Option-click a card on the board. Fields,
  labels, objectives, outcomes and pasted images come across; the activity log does
  not, since those entries record what happened on the original and copying them would
  double every contribution count.
- Activity log: entry list with `!Artefact` / `+Value` / `@person` chips, and a composer
  with date, type, hours and note. Stored notes render token-stripped, since the chips
  already carry the structure, and through the same inline markdown renderer the
  description uses.
- **⌘B / ⌘I** (Ctrl elsewhere) over every text field in the modal, as a toggle: pressing
  again on a marked run strips the marks rather than nesting a second pair, whether they
  sit inside the selection or just outside it. ⌘I never demotes a `**bold**` run to
  italic by peeling one layer — bold is only ever unwrapped by ⌘B.
- **Artefact / value completion** in the composer: typing on a `!` or `+` line offers what
  this card has already logged. Retyping a name by hand is what splits one artefact into
  two — "Local WBS (AI)" and "Local WBS(AI)" are different things to every roll-up
  downstream. ↑↓ move, Enter or Tab accept, Esc dismisses the list without closing the
  modal.
- Archive **or** Delete, as a paired hold-to-confirm selector: 2000ms fill sweep,
  140ms snap-back on release, Delete filling solid rather than tinting. Enter/Space
  arms a two-step confirm as the keyboard path. Deleting is permanent and skips the
  archive flag entirely.
- Empty states for the Intake canvas, empty columns, an empty board, and a board
  filtered down to nothing.

**Not yet in the modal:** reordering images.

## Phase 4a — Objectives panel ✅

- Collapsible year roots ("N objectives · M cards"); children inherit their root's
  year, so a family never splits across two groups.
- Rows indent by depth — no horizon label; nesting alone conveys scope — with measure
  text and directly linked outcomes listed as "→ name".
- 26-week activity heatmap — `color-mix` on `--accent` at `30 + n * 22`% capped at
  100, empty weeks as `--line`, each cell titled "Sep 1 – Sep 7: 3 entries".
- Card, archived and contribution counts are family-inclusive. Linked outcomes are
  not: they stay on the objective they are attached to rather than escalating.
- Editor pane, panel 520 → 900px: name, parent select (descendants excluded so a
  cycle cannot be built), measure, and an outcomes list
  with **+ New**. Autosaves. The same Archive | Delete hold selector as the card
  modal — both promote children to the former parent, so the tree never orphans.
- Escape order: card modal → objective editor → collapse panel.

## Phase 4b — Outcomes panel ✅

- Rows: name, description, the shared **activity map**, a contribution count, and a
  date shown "Sep 5", suffixed "(target)" while still ahead. The handoff's
  share-of-the-busiest bar was dropped: it ranked outcomes against each other, which is
  not what the panel is for.
- Editor, 460px: name, date, description. **No objective picker** — see *Objectives and
  outcomes meet on a card* below.
- **+** creates an outcome and opens its editor with the placeholder name selected.
- Autosaves. Delete is the same hold-to-confirm control as elsewhere.
- Escape order: card modal → objective editor → outcome editor → collapse panel.

Outcomes have no archived flag, so the editor offers Delete alone rather than the
Archive | Delete pair.

## Objectives and outcomes meet on a card

There is no `outcome_objectives` table and no `Outcome.objectiveIds` — migration 2
drops both. An objective is working toward an outcome when a **card** names both, and
the panels read that relation off `task_objectives` + `task_outcomes`. A stored second
copy of the relation could disagree with the cards, and did.

The objective editor labels this "Working toward", not "reached": the board holds
in-flight work, so a card naming both is a commitment, not a result.

Objective roll-ups are **direct only** for the same reason: each row counts the cards
that name that objective, and nothing pools up from its children. A parent with no
cards of its own used to read as the busiest thing on the board, having absorbed every
descendant's activity. Nesting ranks objectives; it does not pool their work.

The objective *filter* is still family-inclusive, deliberately — filtering is a search
convenience where widening helps, not a claim about ownership.

## Artefacts & Values

A tool in the Log's tools menu (see Phase 5). It lists everything the period's work
produced (`!Artefact`) or was worth (`+Value`) in a single chronology, newest first,
filterable by kind, outcome and objective.

It started as its own activity-bar panel over the whole board, and moved under the Log
so it reads the Log's selected period. What came out of this week or this month is the
question worth asking, and the Log's scope and period controls already ask it. The
board-wide list only ever grew. Filters survive stepping between periods, so one
outcome can be followed week by week. While filtered, the pane header counts what was
filtered out ("4 of 10 items") rather than hiding it.

The two kinds share one table because they share one moment — a log entry usually
names both, one being the thing made and the other what it was worth, and two lists
put two halves of the same entry on two screens. The chip carries the kind, so nothing
is lost by interleaving; the Kind filter narrows to one when that is the question.

A flat chronology rather than groups. Even within a period, a year's list outgrows any
fixed grouping, so the filters do the narrowing and the date order is the one thing
that always holds. Rows are **occurrences**, not distinct names: naming the
same artefact on four entries is four days of work on it, and collapsing that to one
row with a count throws away the chronology the list is ordered by.

Each row carries its card (click to open), the outcomes the *entry* was attributed to,
and the objectives its *card* serves — attribution is recorded on the entry, while a
card is what commits work to an objective. The outcome filter has an explicit
"— empty —" option for entries attributed to no outcome, since unattributed output is
the thing worth noticing. It was "— not attributed —" until the filter moved into the
pane, where that label was truncated.

Tokens use the **activity log's own chips** — outlined for an artefact, accent-filled
for a value — so one looks the same wherever it is read. Objectives are prefixed with
the objectives icon, here and on the board's cards, so an objective is never mistaken
for the "→ outcome" beside it.

## Phase 5 — Log panel ✅

- Year / Month / Week / Day scope control, `‹ ›` period stepping, **Today**.
- Summary: period label, three mono metrics, 6px stacked type-breakdown bar, legend.
- Year lists months, Month lists weeks, each drilling down; Week and Day list entries
  grouped under day headers. Clicking an entry opens its card modal.
- Day headers are sticky, opaque bands in 13/700 title case. That sets them apart from
  the uppercase section labels, and the day being read stays named while its entries
  scroll beneath it.
- Artefacts and Values counted distinct over the period as two more summary metrics,
  and shown per entry alongside the outcome chips in Week and Day. Deliberately *not*
  listed as chips in the summary block: over a year or a month that runs to hundreds
  and buries the metrics. The Artefacts & Values tool lists the period's in full instead.
- **Tools menu** (`⋯` in the Log header) holds other readings of the same period, kept
  out of the list itself: **Cards with activity** (what moved), then **Artefacts &
  Values** (what came out of it). A tool opens in a pane beside the list and the panel
  widens from 560 to 960px, the way an objective's editor opens. The pane follows the
  scope and period controls, so it works in every scope. The menu checks the open tool,
  and picking it again closes it, as the activity bar does. Escape closes the menu, then
  the pane, then the panel. **Report** is planned as the next tool.
  An earlier cut listed the cards inline at the top of Week and Day, parted from the
  timeline by a band of `--bg`. The band read as a stray splitter, and the list crowded
  the summary, so both went.
- **Cards with activity** is the first tool. It has one row per card worked on in the
  period, busiest first: title and hours, then lane and entry count, clicking through
  to the card. Its hours reconcile with the period total. Titles wrap rather than
  truncate, since which cards moved is the point of the list.
  Archived cards are **included and marked**. A card archived on Thursday still
  absorbed Monday's hours, and a report that silently drops it cannot be reconciled
  against the period's totals. This is the spine of a weekly report: what moved, then
  how it moved.
- The roll-up is on the client. A server-side aggregate endpoint would be worth it if
  it got slow; at this data size it does not.

## Shared activity map

Objectives and Outcomes render the same `<ActivityMap>`: a single 10px row with one
cell per day over the last 30, today at the right edge. It replaced a three-row,
90-day grid. One row keeps each objective and outcome compact, and recent days are what
the map is read for. The two lists are meant to be read against each other, which only
holds while the granularity, span and colour ramp are identical. So the span lives in
`ACTIVITY_MAP_DAYS` alone, and the layout takes its cell count from the data.

Neither panel counts cards any more. The header already counts cards, against the
active filters, and a second unfiltered count beside it only ever disagreed with it.
Contributions — log entries booked against the objective's family, or attributed to
the outcome — are what both panels count instead.

## Phase 6 — Finish

- **Keyboard parity for every drag interaction** (reorder lanes, columns, cards) — the
  handoff lists this as an outstanding item, and it is the largest accessibility gap.
- Card accent setting (Off / Lane / Priority) and a column-width control.
- Edit an existing log entry in place.
- Vendor IBM Plex locally. It currently loads from Google Fonts, which is the one thing
  in the app that reaches the network; the fallback stack covers an offline start, but
  vendoring makes it genuinely local.
- Archive views: archived cards and objectives are stored and hidden but have no UI.
- JSON import to match `/api/export`.

## Later — Local LLM (LM Studio)

Deliberately unbuilt. When a reporting feature is specified, add a route under
`apps/api/src/routes/` that reads through the repo layer and calls LM Studio's
OpenAI-compatible endpoint at `http://localhost:1234/v1`. The log entries, their parsed
artefacts/values/people, and the objective tree are already stored and served — the data
side needs nothing. Candidate first feature: a weekly summary over the Log panel's
current period.
