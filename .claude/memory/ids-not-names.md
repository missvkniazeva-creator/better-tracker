---
name: ids-not-names
description: Objectives, outcomes and labels relate by id, deliberately departing from the handoff's by-name data model
metadata:
  type: project
---

The database relates tasks to objectives, outcomes and labels **by id**. The design
handoff's data model relates them by name and requires every rename to cascade across
tasks, outcomes, child objectives and filter selections.

**Why:** the handoff itself says a real backend should "prefer stable ids with a display
name, and drop the cascade". Renaming is now a single-row UPDATE and nothing can drift.

**How to apply:** when porting logic out of the prototype, translate name lookups into id
lookups — the prototype's `objChildren(name)` becomes `objectiveFamily(objectives, id)` in
`apps/web/src/lib/derive.ts`. Derived values that are *not* stored stay derived: a card's
phase comes from its position in its own lane's column order, never from a column name.
Objectives carry no horizon label — the handoff's Long-term / Month / Week mapping to
depth was dropped on 2026-09-09 because real second-level objectives are often long-term,
so the label contradicted the data. Depth alone ranks them.

Related: [[design-handoff-is-spec]]
