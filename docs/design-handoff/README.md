# Design handoff

The original bundle, kept whole so this repository is the only thing needed to work on
the design — there is no need to go back to the handoff zip.

| File | Original name | What it is |
|---|---|---|
| `handoff.md` | `README.md` | **The spec.** Layout, screens, data model, tokens, interactions. High fidelity: the values in it are final. |
| `prototype.dc.html` | `Better Tracker v2.dc.html` | The running prototype. Open it directly in a browser — no build step. |
| `colors_and_type.css` | same | Foundation stylesheet the prototype links. |
| `support.js` | same | Prototyping-environment runtime. |

Two files are renamed above; `handoff.md`'s own Files table still uses the original
names.

## Reading the prototype

Open `prototype.dc.html` in a browser. **It needs `support.js` beside it** — that file
resolves the `{{ … }}` bindings and `<sc-if>` / `<sc-for>` template tags. Without it the
page still loads, but every screen renders stacked on top of the others with the
bindings showing as literal text.

`handoff.md` says of `support.js`: "Not part of the design — no need to port it." That
means do not carry its patterns into the app. It is still needed to *view* the
prototype, which is why it is kept here.

**Viewing it needs an internet connection.** `support.js` pulls React 18.3.1 and
Babel standalone from unpkg.com, and the page pulls IBM Plex from Google Fonts.
Offline, the prototype does not render. Nothing in Better Tracker itself depends on
these — the app's own only network call is the same Google Fonts stylesheet, and that
has a real fallback stack.

## Using it

The written spec answers most questions. Where it does not, the prototype's markup is
the authority — it carries the exact px values, and its `class Component` script at the
bottom holds the derived-value logic (`taskPhase`, `objChildren`, `horizonFor`, the
26-week heatmap fill). Both were read directly when building the board, card modal and
panels.

Its two construction choices are explicitly **not** to be copied: inline `style`
attributes, and all state in one component object with seeded demo data. See
`../../.claude/memory/design-handoff-is-spec.md`.
