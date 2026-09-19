# Better Tracker

A single-user work-tracking board: an **Intake** canvas for unsorted cards, configurable
**lanes** and **columns** for clarified work, and three panels — **Objectives**,
**Outcomes**, **Log**.

Local-only. Nothing leaves the machine, there is no account, and the API binds to
`127.0.0.1`.

## Run it

```bash
npm install
npm run up           # web on :5173, API on :8787, both with reload
```

Open <http://localhost:5173>.

`npm run up` is safe to run again at any time — it starts what is missing, leaves a
healthy pair alone, and replaces anything holding a port that is unhealthy or serving
the wrong database. The companions:

```bash
npm run ps           # what is running, and which database the API has open
npm run logs         # tail both logs
npm run down         # stop both
npm run restart      # down, then up
```

Point them at a throwaway copy with `BT_DB_PATH=/tmp/scratch.db npm run up` — useful
for trying something out without touching `data/better-tracker.db`.

(`npm run dev` still runs both in the foreground. Prefer `npm run up`: a foreground
run that loses its terminal leaves an orphan holding :8787, and the next start then
silently talks to that orphan's database instead of yours.)

To run it as one process instead (the API serves the built SPA):

```bash
npm start            # builds the web app, serves everything on :8787
```

## Data

SQLite, at `data/better-tracker.db` — gitignored, so the database is yours and never
committed. Back it up by copying the file.

```bash
npm run db:reset     # empty the board, keep the three default lanes
npm run seed:demo    # load the design prototype's demo content
```

`GET /api/export` returns the whole board as JSON if you want a portable copy.

> The API holds the database open. After `db:reset` against a running server, restart it
> — otherwise it keeps serving the rows it already had.

## Checks

```bash
npm test             # repo-layer tests (node:test)
npm run typecheck    # both workspaces
```

## Layout

| Path | What |
|---|---|
| `apps/web` | React 19 + Vite SPA. Design tokens in `src/styles/tokens.css`. |
| `apps/api` | Fastify + `node:sqlite`. No build step — Node strips the types. |
| `shared/` | Wire types and the log-note parser, imported by both. |
| `docs/design-handoff/` | The design spec and prototype this is built from. |
| `docs/implementation-plan.md` | What is built, what is next. |
| `.claude/memory/` | Project memory for Claude Code sessions. |

## Requirements

Node 24+ (26 recommended). The API uses `node:sqlite` and Node's native TypeScript
support, so there is no native module to compile and no server-side bundler.
