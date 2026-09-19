# Better Tracker

Single-user, local-only work-tracking board. React 19 + Vite SPA (`apps/web`) against a
Fastify API (`apps/api`) over SQLite (`data/better-tracker.db`).

## Memory

Project memory lives in this repository at `.claude/memory/`, not in the user's home
directory. `.claude/memory/MEMORY.md` is the index — one line per memory, content in the
individual files. Write new memories there.

## Working here

- **`docs/design-handoff/handoff.md` is the spec.** It is high fidelity: colours, sizes,
  spacing and copy are final. Match them. Lift *values* from the prototype, never its
  technique — its inline styles and single `state` object are prototyping artefacts.
- **Never hard-code a colour.** Everything comes from `apps/web/src/styles/tokens.css`.
  Lane tints derive with `color-mix()`, label chips with `oklch()` off a hashed hue. A
  literal hex breaks one of the two themes silently.
- **Relations are by id**, deliberately unlike the handoff's by-name model. See
  `.claude/memory/ids-not-names.md`.
- **Keep derived values derived.** A card's phase comes from its index in its own
  lane's columns — never match on a column name, users rename them. Objectives have no
  horizon label: depth in the tree is the only ranking. Objectives and outcomes have no
  stored link at all — they meet on a card, and roll-ups never propagate up the
  objective tree. See `.claude/memory/implicit-objective-outcome.md`.
- The API has no auth and must stay bound to loopback.

## Commands

```bash
npm run up         # start web :5173 + API :8787, idempotently  (scripts/dev.sh)
npm run ps         # what is running, and which database the API has open
npm run down       # stop both, clearing strays
npm run logs       # tail .dev/api.log and .dev/web.log

npm test           # node:test, repo layer
npm run typecheck  # both workspaces
npm run db:reset   # empty board, default lanes  (npm run restart afterwards)
npm run seed:demo  # prototype demo content
```

**Use `npm run up`, not `npm run dev`.** `npm run dev` runs both servers in the
foreground and leaves its `node --watch` supervisor behind whenever a terminal goes
away. The orphan keeps port 8787 and answers from whatever database *it* was started
with, so the next `npm run dev` loses the port silently and the browser shows the
wrong board — which looks exactly like data loss. `npm run up` converges instead:
it checks what is listening *and* which database that process has open, replaces it
if either is wrong, and reaps strays. Set `BT_DB_PATH` to serve a throwaway copy.

## Conventions

- Server code runs through Node's type stripping, so it must stay *erasable* TypeScript:
  no enums, no parameter properties, and `import type` for type-only imports.
- Every mutating endpoint returns the full board snapshot; the client replaces its state
  wholesale rather than merging.
- SQL lives in the `apps/api/src/repo/` modules. Routes stay thin.
- Schema changes append a migration to `MIGRATIONS` in `apps/api/src/db/index.ts` —
  never edit `schema.sql` for an existing database.
