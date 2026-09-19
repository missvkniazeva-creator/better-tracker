# Handoff: Better Tracker — personal work board

## Overview

Better Tracker is a single-user work-tracking board for a forward-deployed engineer:
an **Intake** free-placement canvas for unsorted cards, configurable **lanes** with
configurable **columns** for clarified work, and a left tool rail with three panels —
**Objectives** (nested goal tree), **Outcomes** (named results), and **Log** (time-scoped
activity roll-up). Cards carry priority, labels, severity, a dateline, obstacles, an
activity log with contribution attribution, and pasted image attachments.

The design covers the complete surface: board, panels, editors, modals, filters, light
and dark themes.

## About the design files

The files in this bundle are **design references authored in HTML**. They are a
prototype of intended look and behaviour, not production code to lift verbatim.
The task is to **recreate these designs in the target codebase's own environment**
(React, Vue, SwiftUI, native, whatever is in use) with its established component
library, state layer, and styling conventions. If no environment exists yet, choose an
appropriate stack and implement the designs there.

Two implementation notes about the prototype's construction that should **not** be
carried over:

- All styling is written as inline `style` attributes. That is a constraint of the
  prototyping environment. In the real codebase use its normal styling approach and
  lift the *values* (below) rather than the technique.
- All state lives in one component's `state` object with seeded demo data and no
  persistence. The real implementation needs a data layer (see **Data model**).

## Fidelity

**High-fidelity.** Colours, type sizes, spacing, borders, hover states, and copy are
final and should be matched. Every colour is already a design token (see **Design
tokens**); light and dark themes are both specified.

## Layout shell

Root: `height:100vh; display:flex; flex-direction:column; overflow:hidden` — the app
fills the viewport and never scrolls at document level. Every list scrolls internally.

Top to bottom:

1. **Header** (auto height, `padding:10px 20px`, `background:var(--surf)`,
   `border-bottom:1px solid var(--line2)`)
   - Left: wordmark "Better Tracker" (16px/700, `letter-spacing:-0.01em`) plus the week
     stamp "Wk 36 · Sep 1–5, 2026" (12px, IBM Plex Mono, `--ink3`).
   - Centre: search field, 30px tall, `min-width:280px`, magnifier icon 16px,
     placeholder "Search tasks, obstacles, activity…".
   - Right: theme toggle (30×30, sun/moon), Filters toggle (shows active filter count),
     "Log entry" primary button (`background:var(--ink)`, `color:var(--on-ink)`,
     hover `--ink-hover`).
2. **Filters bar** — collapsible, `padding:8px 20px`, wraps. Four groups: Labels,
   Priority, Flags, Objectives. All chips are 22px tall, `border-radius:2px`, 10px
   uppercase, `letter-spacing:0.05em`. Active chip = `background:var(--ink)`,
   `color:var(--surf)`. Every group is multiselect.
3. **Workspace** (`flex:1; display:flex; min-height:0`)
   - **Activity bar** — 48px wide, `background:var(--surf)`,
     `border-right:1px solid var(--line2)`. Three 38×38 icon buttons: Objectives
     (target), Outcomes (flag), Log (clock). Active tool: `background:var(--ink-a06)`,
     `color:var(--ink)`, `box-shadow:inset 2px 0 0 var(--accent)`. Clicking the active
     tool collapses the panel to icons only.
   - **Side panel** — docked, not an overlay; the board reflows beside it.
     `width` is per tool: Objectives 520 (900 with editor open), Outcomes 460 (860 with
     editor), Log 560. Capped at `calc(100vw - 48px)`; columns are `flex:1 1 <base>`
     with `min-width:0` so they shrink instead of overflowing.
   - **Board** — `flex:1; min-width:0; overflow:auto`.

## Screens / views

### 1. Board — Intake

Free-placement canvas at the top of the board. Header row (`background:var(--head)`,
`padding:8px 14px`, wraps): chevron toggle, "Intake", card count in IBM Plex Mono.

- Canvas: `position:relative; overflow:auto; height:<intakeHeight>px`, resizable by a
  drag handle at the bottom edge (96–2400px).
- Cards are absolutely positioned at stored `x`/`y`, `width: colWidth − 20`, capped by
  `max-width:calc(100% - 32px)` so they shrink rather than clip.
- Double-clicking empty canvas creates a card at that point and opens its modal.
- Dragging a card within Intake repositions it; dragging it onto a lane column moves it
  into that column. Drop coordinates account for canvas scroll offset.

### 2. Board — Lanes

One block per lane: `border:1px solid var(--line2)`, `border-top:3px solid <laneColor>`,
`border-radius:4px`, `background:var(--panel)` (recessed, so white cards read above it).

**Lane header** (`background: laneTint`, `padding:8px 14px`, wraps, `cursor:grab`):
grip dots (6-dot SVG, `--ink4`) · chevron button (20×20, collapses the lane) · title
button (click to rename; hover `background:var(--ink-a06)`) · card count · hint text
(ellipsised) · right-aligned stats (contributions, obstacles) · "+ Col" · delete-lane.

- **Rename mode** replaces the title with a 24px input (text preselected on focus,
  Enter commits, Esc cancels) plus seven 18×18 colour swatches; the current colour is
  ringed with `--ink`. Picking a swatch applies on `mousedown` so focus is not lost.
- **Reorder**: the header row is `draggable`; the drop target shows
  `box-shadow: inset 0 3px 0 var(--ink)`. Dragging down inserts after, up inserts before.
- A single dashed **"+ Lane"** strip (22px, uppercase 10px) sits above the last lane.

**Columns** (inside a lane, horizontal flex, each `flex:0 0 <colWidth>px`, `min-width:0`):

- Column header row is `draggable` for reordering within the lane; drop target shows
  `inset 3px 0 0 var(--ink)`. Contents: grip (8×12) · chevron (18×18, collapse) ·
  title button (click to rename, 11px uppercase 600) · count.
- Collapsed column = 34px vertical strip with rotated label; still a drop target for
  cards and a drag handle for reordering.
- Card list is the column's drop zone.

**Card** (`border:1px solid var(--line)`, `border-radius:4px`, hover
`border-color:var(--ink)`):

- Left edge stroke encodes dateline state: `inset 3px 0 0 var(--danger)` when overdue
  (dateline past and not in the lane's last column), `var(--ink3)` when a dateline is
  set and ahead, `var(--line2)` when no dateline.
- Title: 13px/1.35, `display:block; min-height:35px` — two lines are always reserved so
  card headers align.
- Meta row: priority glyph (P1 chevrons-up `--danger`, P2 chevrons-right `--warn`,
  P3 chevrons-down `--ink3`), severity ▲ for High, label chips, dateline, obstacle
  warning triangle, log-entry count.
- Background: `var(--danger-soft)` when the card has an obstacle, else `var(--surf)`.

### 3. Card modal

Opened by clicking a card. Sections:

- **Title** (editable), lane name, and a segmented **state** control listing that
  lane's actual columns (or "Intake").
- **Archive** — hold-to-confirm button in the header (see **Hold to archive**).
- **Description** — Write / Preview toggle chips. Write is a textarea supporting a
  small markdown subset; Preview renders it. **Pasting an image (⌘V) attaches it**:
  the file is read as a data URL, stored on the task as `{id, name, src}`, and a
  `![name](id)` reference is inserted at the caret. A 64×48 thumbnail strip appears
  under the textarea, each with a × that removes both image and reference.
- **Obstacles** — same Write/Preview pair, empty state "Nothing blocking."
- **Priority / severity / dateline** (`<input type="date">`) / **labels**.
- **Objectives** and **Outcomes** multi-select lists.
- **Activity log** — entry rows: date · type (Focus / Meeting / Call / Multitasking) ·
  hours · note (12px, `line-height:19px` so it baselines with its siblings) · outcome
  chips. The composer parses `!Artefact`, `+Value`, and `@person` out of the note.

### 4. Objectives panel

Header: accent rule (32×4), "Objectives", **+** (new objective) and **×** (collapse).

Rows are grouped under a **collapsible year root** (`background:var(--surf2)`,
chevron + year in IBM Plex Mono 13/700 + "N objectives · M cards"). Children inherit
their root objective's year, so the tree stays intact under one group.

Objective row (`padding:12px 24px 12px <24 + level*18>px`, click = edit):

- Name (14px/700 at level 0, 13px/600 level 1, 13px/400 deeper) and horizon label
  (10px uppercase) derived from depth: 0 → LONG-TERM, 1 → MONTH, 2+ → WEEK.
- Measure text, 12px `--ink2`.
- **Activity heatmap** — 26 weekly cells, `flex:1`, 10px tall, `gap:2px`,
  `border-radius:1px`. Empty week = `var(--line)`; otherwise
  `color-mix(in srgb, var(--accent) <30 + n*22>%, var(--surf))` capped at 100.
  Title attribute: "Sep 1 – Sep 7: 3 entries".
- Counts: "N cards · M archived" and "K contributions" (family-inclusive: the
  objective plus all descendants).
- Linked outcomes listed as "→ name" in `--accent`.

**Editor pane** (opens to the right, panel grows to 900px): Name · Parent objective
(select) · Horizon (read-only, derived from nesting) · Measure · Outcomes checklist
with a **+ New** button that creates an outcome already linked to this objective.
Header has hold-to-archive and ×. **Autosaves** — no Save or Cancel.

Archiving hides the objective, promotes its children to its former parent, and drops it
from the filter chips; tasks keep their references.

### 5. Outcomes panel

Rows (click = edit): name (13/600), description, a contribution bar
(`height:6px`, width = share of the most-supported outcome), "N cards", linked
objective name, and date. Editor pane: Name · **Objective picker** rendered as an
inline indented tree list with radio dots (not a select) plus "— unassigned —" ·
Date (`<input type="date">`) · Description. Autosaves.

Dates are stored ISO and displayed as "Sep 5", suffixed "(target)" when in the future.

### 6. Log panel

Scope segmented control: **Year · Month · Week · Day**, plus ‹ › period stepping and
**Today**.

- Summary block, every scope: period label (14/700), three metrics in IBM Plex Mono
  24/700 — Entries, Hours, Contributions (accent) — a 6px stacked type-breakdown bar,
  and a legend. Type colours: Focus `--ink`, Meeting `--accent`, Call `--lane2`,
  Multitasking `--warn`.
- **Year** lists 12 month rows; **Month** lists its week rows. Each row: label ·
  proportional bar · "N entries" · hours · ›. Clicking drills down (Year → Month →
  Week).
- **Week** and **Day** additionally list entries grouped by day under a sticky-styled
  day header ("Monday, Sep 7" + "4 · 6.5h"). Entry: type · task title · hours · note ·
  outcome chips. Clicking an entry opens its task modal.

### 7. Delete-lane dialog

Deleting a non-empty lane opens a dialog to choose a target lane or Intake. Cards merge
by column name; columns missing in the target are recreated there so card structure is
preserved.

## Interactions & behaviour

- **Drag and drop**: cards between columns and into/inside Intake; lanes reorder by
  header; columns reorder within their lane. Insertion is shown with an inset ink rule,
  never a ghost placeholder.
- **Inline rename**: lane and column titles open an input with the text **preselected**;
  Enter commits, Esc cancels, blur commits.
- **Hold to archive**: all archive actions require a 2-second press. On `pointerdown`
  a `--danger-soft` fill sweeps the button over 2000ms (`transition: width 2000ms
  linear`) and the border/label turn `--danger`; `pointerup` or `pointerleave` cancels
  and the fill snaps back over 140ms.
- **Autosave**: objective and outcome editors commit on change; text fields commit on
  blur. Esc commits and closes.
- **Escape order**: objective editor → outcome editor → delete-lane dialog → card modal
  → collapse panel.
- **Transitions**: 150ms ease-out on hover/background/colour; 180ms ease-out on panel
  width.
- **Theme**: toggled from the header, applied as `data-theme="dark"` on
  `document.documentElement`; also exposed as a `theme` prop (Light/Dark).

## Data model

```ts
Task {
  key: string; lane: string; col: string;      // col "" = Intake
  title: string; desc: string; obstacles: string;
  labels: string[]; prio: "P1"|"P2"|"P3"; sev: "Low"|"High";
  dateline: string;                            // ISO yyyy-mm-dd
  objectives: string[]; outcomes: string[];    // by name
  images: { id: string; name: string; src: string }[];
  log: LogEntry[];
  archived: boolean; x: number; y: number;     // x/y used by Intake only
}
LogEntry { date: string; iso: string; type: "Focus"|"Meeting"|"Call"|"Multitasking";
           note: string; hours: string; artefacts: string[]; values: string[];
           people: string[]; outcomes: string[] }
Lane { id: string; name: string; hint: string; cols: string[]; color: string }
Objective { name: string; parent: string; measure: string; year: number; archived?: boolean }
Outcome { name: string; objective: string; desc: string; date: string }
```

Relationships are **by name**, so every rename must cascade: renaming an objective
rewrites tasks, outcomes, child objectives, and filter selections; renaming an outcome
rewrites task references and log-entry attributions. In a real backend prefer stable
ids with a display name, and drop the cascade.

Derived values worth reimplementing exactly:

- `taskPhase(task)` — position within its own lane, not a hard-coded column name:
  last column = staged, first = pending, anything between = in action. Column names are
  user-editable, so never match on them.
- `objChildren(name)` — recursive descendants; all objective roll-ups are
  family-inclusive.
- `horizonFor(level)` — `["Long-term","Month","Week"][min(level,2)]`.

## UI state

`search`, `labelFilter`, `prioFilter`, `objFilter` (all maps used as sets),
`obstacleFilter`, `sevFilter`, `filtersOpen`, `tool` (objectives|outcomes|log),
`panelOpen`, `collapsedLanes`, `collapsedCols`, `collapsedYears`, `laneOver`,
`colOver`, `drag`, `modalKey`, `objEdit`, `outEdit`, `laneKill`, `hold`,
`logScope`, `logAnchor`, `theme`, `intakeH`.

The prototype pins "today" to **2026-09-08** via a `today()` helper so demo data lines
up. Replace it with the real clock.

## Design tokens

Light (`:root`):

```
--bg:#d9e0e9  --surf:#ffffff  --surf2:#fafaf9  --surf3:#f1f5f9  --head:#e3e9ef
--panel:#eef1f6  --line:#e2e8f0  --line2:#c3ccd7
--ink:#1f2937  --ink2:#475569  --ink3:#64748b  --ink4:#94a3b8
--on-ink:#ffffff  --on-color:#ffffff  --ink-hover:#0f1620
--accent:#0f766e  --accent-solid:#0f766e  --accent-soft:#ccfbf1  --accent-wash:#e4f0ed
--danger:#9f1239  --danger-solid:#9f1239  --danger-solid-hover:#7d0e2d  --danger-soft:#fdf1f2
--warn:#b45309  --warn-soft:#fdf4e7  --good:#15803d
--ink-a06:rgba(31,41,55,.06)  --ink-a10:rgba(31,41,55,.10)  --scrim:rgba(31,41,55,.24)
--shadow:rgba(15,23,42,.04)  --tint-a:22%  --wash-a:8%
--lane1:#0f766e --lane2:#2d5a9e --lane3:#64748b --lane4:#14607a
--lane5:#5b4b9e --lane6:#6b5647 --lane7:#7d4471
```

Dark (`html[data-theme="dark"]`):

```
--bg:#0c1016  --surf:#1d242f  --surf2:#1e2530  --surf3:#232b37  --head:#1f2731
--panel:#11161e  --line:#2b3441  --line2:#3a4552
--ink:#e6ebf1  --ink2:#b4c0cd  --ink3:#8a97a5  --ink4:#6b7885
--on-ink:#10151b  --on-color:#ffffff  --ink-hover:#ffffff
--accent:#4fb3a4  --accent-solid:#14655d  --accent-soft:#123c37  --accent-wash:#14322f
--danger:#f08099  --danger-solid:#a32742  --danger-solid-hover:#8d1f36  --danger-soft:#38191f
--warn:#d79a45  --warn-soft:#362810  --good:#55ab6f
--ink-a06:rgba(255,255,255,.05)  --ink-a10:rgba(255,255,255,.09)  --scrim:rgba(0,0,0,.55)
--shadow:rgba(0,0,0,.4)  --tint-a:26%  --wash-a:12%
--lane1:#3f9e93 --lane2:#6592cf --lane3:#8996a6 --lane4:#4a9cb5
--lane5:#8f83d1 --lane6:#a8907c --lane7:#b57ea8
```

Lane tint and wash are derived, never hard-coded:
`tint = color-mix(in srgb, <lane> var(--tint-a), var(--surf))`,
`wash = color-mix(in srgb, <lane> var(--wash-a), var(--surf))`.

Label chips are generated from a hash of the label name as an oklch hue:

- light, inactive: border `oklch(.86 .06 H)`, bg `oklch(.965 .025 H)`, text `oklch(.45 .12 H)`
- light, active: bg and border `oklch(.55 .13 H)`, text `#fff`
- dark, inactive: border `oklch(.40 .06 H)`, bg `oklch(.27 .04 H)`, text `oklch(.82 .09 H)`
- dark, active: bg and border `oklch(.62 .13 H)`, text `oklch(.18 .03 H)`

**Typography** — UI: "IBM Plex Sans", Helvetica Neue, Arial, sans-serif. Numerics,
counts, dates, chevron glyphs: "IBM Plex Mono". Base 13px / line-height 1.4. Scale:
24 (metrics) · 16 (panel and app titles) · 14 (period label, level-0 objective) ·
13 (body, card title, inputs) · 12 (secondary) · 11 (meta, chips) ·
10 (uppercase labels, `letter-spacing:0.05em`) · 9 (badges).

**Spacing** — 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24. **Radii** — 1 (heatmap
cell) · 2 (chips) · 3 (icon buttons) · 4 (cards, panels, inputs) · 50% (radio dots).
**Control heights** — 18 / 20 / 22 (chips) / 24 / 26 (icon buttons) / 28 / 30 (inputs,
primary buttons) / 38 (activity-bar icons). **Shadow** —
`0 1px 2px var(--shadow)`; elsewhere `box-shadow` is used for inset edge rules, not
elevation.

## Configurable props

Exposed as tweakable props on the prototype; wire the useful ones to real settings.

| Prop | Type | Default | Effect |
|---|---|---|---|
| `theme` | Light / Dark | Light | Sets `data-theme` |
| `colWidth` | 200–480 px | 360 | Column width; Intake card width follows it (−20) |
| `intakeHeight` | 120–480 px | 190 | Initial Intake canvas height |
| `internalFirst` | boolean | false | Swaps the first two lanes |
| `cardAccent` | Off / Lane / Priority | Off | Card accent colour source |

## Accessibility notes to close in implementation

The prototype leans on `title` attributes and pointer events. In the real build add:
keyboard equivalents for every drag interaction (reorder lanes, columns, cards), real
`aria-label`s on the icon-only buttons, focus rings on all interactive elements
(currently only inputs get `outline:1px solid var(--ink)`), a keyboard path for
hold-to-archive (e.g. a confirm step), and `aria-live` on the filter result count.

## Assets

No external images or icon fonts. All icons are inline SVG, 1.6–1.8 stroke width,
`stroke-linecap:round`, `stroke-linejoin:round`, sized 12–19px, coloured with
`currentColor`. Fonts are IBM Plex Sans and IBM Plex Mono (webfont link in the
prototype's `<helmet>`).

## Files

| File | What it is |
|---|---|
| `Better Tracker v2.dc.html` | The complete design. Opens in a browser with no build step. Markup is the template; the `class Component` script at the bottom holds all logic. |
| `colors_and_type.css` | Foundation stylesheet the prototype links (type and base colour rules). Note it defines a global `p { font-size:16px; color:#1f2937 }` — the prototype's rendered markdown overrides it with `font:inherit;color:inherit`, worth knowing if text looks oversized or invisible in dark mode. |
| `support.js` | Prototyping-environment runtime. **Not part of the design** — no need to port it. |
