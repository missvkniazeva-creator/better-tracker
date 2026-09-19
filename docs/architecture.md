# Architecture

## Shape

```
browser  ──▶  Vite dev server :5173  ──/api──▶  Fastify :8787  ──▶  SQLite file
                (proxies /api)                    (loopback)        data/better-tracker.db
```

In production `npm start` builds the SPA and Fastify serves it, so there is one process
on one port. The dev split exists only for HMR.

Nothing is exposed beyond `127.0.0.1` and there is no authentication. That is a design
constraint, not an omission: adding a network binding would require adding auth first.

## Why the API returns the whole board

Every mutating endpoint responds with a complete `BoardSnapshot`. A single user's tracker
is small, and the alternative — patching local state from partial responses — has to
replicate server-side cascades on the client. Deleting a lane relocates cards and can
create columns; archiving an objective reparents its children. Re-sending everything
makes those impossible to get wrong, and the client's update path is one assignment.

## Type sharing without a build

`shared/types.ts` and `shared/parse.ts` are imported by both sides. The web app resolves
them through a Vite alias (`@shared`); the API imports them by relative path and Node
strips the types at load. There is no compile step and no generated client, so the wire
format cannot drift from what either side believes it is.

The constraint this imposes: server-side TypeScript must be **erasable** — no enums, no
parameter properties, `import type` for type-only imports. `tsc --noEmit` enforces it via
`erasableSyntaxOnly`.

## Data model

Sixteen tables, all relations by id. Outcomes relate to objectives through
`outcome_objectives`: one outcome can support several objectives at once. See `apps/api/src/db/schema.sql`, whose comments
record the departures from the design handoff's model and why.

Two things are deliberately **not** stored, because storing them lets them go stale:

- A card's **phase** — derived from its column's index within its own lane.
- An objective's **roll-ups** — derived at read time. Card, archived and contribution
  counts are family-inclusive; **linked outcomes are not**, because a result belongs to
  the objective it is attached to, not to every ancestor above it.

Objectives carry no horizon label. Depth in the tree is the only ranking, shown by
indentation — a fixed Long-term / Month / Week mapping was wrong often enough (a
second-level objective is frequently long-term) that the label misinformed.

Positions are fractional `REAL`s spaced 1000 apart, so a reorder is one `UPDATE` rather
than a renumbering of the column.

## Migrations

`PRAGMA user_version` counts applied migrations; `MIGRATIONS` in `apps/api/src/db/index.ts`
is the ordered list, each applied in its own transaction. Migration 1 is all of
`schema.sql`; migration 2 replaced `outcomes.objective_id` with the
`outcome_objectives` join table, carrying existing links across before dropping the
column. **Schema changes append a new entry** — editing `schema.sql` only affects
databases created from scratch and would silently skip existing ones.

## Images

Pasted images are stored as `BLOB` and served from `/api/images/:id` with an immutable
cache header. They are never inlined as data URLs in the board snapshot: base64 inflates
by a third, and the snapshot is re-fetched on every mutation.
