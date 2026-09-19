---
name: stack-decisions
description: The stack Better Tracker was set up with and the alternatives that were considered and rejected
metadata:
  type: project
---

Better Tracker runs local-only: a React 19 + Vite SPA (`apps/web`) talking to a Fastify
API (`apps/api`) over `/api`, persisting to SQLite at `data/better-tracker.db`.
`npm run dev` runs both with HMR; `npm start` builds the SPA and serves it from the API
on one port. The API binds to 127.0.0.1 and has no authentication — it is single-user by
design and must not be exposed to a network.

Two choices worth not relitigating:

- **`node:sqlite`, not better-sqlite3.** Node 26 ships SQLite in core, so the API has no
  native module to rebuild and no compile step. TypeScript runs through Node's own type
  stripping — there is no bundler or `tsc` build on the server side at all.
- **Plain CSS with custom properties, not Tailwind.** The handoff's tokens, `color-mix()`
  lane tints and `oklch()` label chips are already a design system; utilities would have
  meant arbitrary-value escapes on nearly every rule.

Rejected: Tauri and Electron (no Rust toolchain here, and a browser tab is enough for a
local board).

Related: [[design-handoff-is-spec]], [[ids-not-names]]
