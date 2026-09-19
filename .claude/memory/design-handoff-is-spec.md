---
name: design-handoff-is-spec
description: The design handoff is a high-fidelity spec to match exactly, and where its source files live
metadata:
  type: project
---

`docs/design-handoff/` holds the design bundle: `handoff.md` (the written spec),
`prototype.dc.html` (the running prototype), `colors_and_type.css`. The handoff is
**high fidelity** — colours, type sizes, spacing, borders, hover states and copy are
final and are meant to be matched, not approximated.

**Why:** the values in it are already decided, so any deviation is a regression rather
than a judgement call — and both themes are fully specified, so a hard-coded colour
breaks one of them silently.

**How to apply:** lift values from the handoff, never the technique. The prototype's
inline `style` attributes and single-component `state` object are artefacts of the
prototyping environment and are explicitly not to be carried over. `support.js` from the
original zip is prototyping runtime and was not copied into the repo. Never hard-code a
colour: everything derives from the tokens in `apps/web/src/styles/tokens.css`.

Related: [[stack-decisions]]
