---
name: implicit-objective-outcome
description: Objectives and outcomes have no stored link — they meet on a card — and no roll-up propagates up the objective tree
metadata:
  type: project
---

There is **no objective↔outcome link table**. The `outcome_objectives` table and
`Outcome.objectiveIds` were removed on 2026-09-10 (migration 2). An objective reaches
an outcome when a *card* names both, and the panels read that relation back off
`task_objectives` + `task_outcomes`.

Objective roll-ups are also **direct only** — `objectiveStats` counts the cards that
name that objective and nothing else. Nothing pools upward from children.

**Why:** a stored second copy of the relation could disagree with the cards, and did —
outcomes appeared under objectives no work connected them to. Family-inclusive
roll-ups had the matching problem: a parent with no cards of its own read as the
busiest thing on the board, because it had absorbed every descendant's activity.
Nesting is meant to rank objectives, not pool their work.

**How to apply:** never reintroduce an editable objective↔outcome control. The
Outcomes editor has no objective picker and the Objectives editor's "Working toward"
list is read-only and derived — worded that way on purpose, since a board holds
in-flight work and a card naming both is a commitment rather than a result. To relate the two, link a card to both — that card is
the evidence for the relation. Note the objective *filter* in `matchesFilters` is
still family-inclusive, deliberately: filtering is a search convenience where widening
helps, not a claim about ownership.

Related: [[ids-not-names]], [[design-handoff-is-spec]]
