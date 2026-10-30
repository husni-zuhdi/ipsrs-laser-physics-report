# ADR-0001: Deepen math rendering behind an Equations module with an adapter seam

**Status:** accepted, 30 Oct 2026 · Affects: `js/equations.js` (new), `js/widgets.js`, `index.html`, `tests.js`, `package.json`

## Context

Equation rendering had no interface. The TeX registry, the fallback policy and the
diagnosis policy all lived inside `js/widgets.js`, and a `try/catch` silently swallowed
every rendering failure. During the Oct 2026 architecture review this exact configuration
had already buried 34 rendering failures with zero diagnostics — the failure only
surfaced because a reviewer ran the page under a DOM emulator by hand.

Registry keys (`data-eq` in `index.html` ↔ `EQS` in widgets.js) were kept in sync purely
by string convention, silently skipped on typos, and could not be verified from Node.

## Decision

1. Own the concern in a dedicated deep module, **`js/equations.js`** (global `window.Equations`,
   dual-export like `physics.js`), exposing a small interface:

   | Method | Role |
   |---|---|
   | `define(key, tex)` / `defineAll(defs)` / `get(key)` / `keys()` | registry |
   | `renderAll(doc)` | render every `.eq[data-eq]` div + auto-numbering |
   | `render(el, tex, displayMode, key)` | render live equation panels |
   | `setAdapter(adapter)` | the seam; defaults to auto-discovering `window.temml` |

2. **Failure policy** (decided in review): on any render failure (missing library, parse
   error, exception) the element keeps the readable raw TeX in a `<code class="tex-fallback">`,
   and `console.warn` names the equation key and reason. No silent burial, no destructive
   error message replacing content.

3. **Node-side validation via devDependency** (decided in review): `temml@0.11.3` is an npm
   devDependency; `tests.js` (a) asserts the HTML↔registry contract in both directions and
   (b) parses every registered TeX string with `renderToString` (DOM-free). The website
   itself remains build-free.

4. Widget code consumes only the module interface; the Tex strings moved out of widgets.js
   with the registry.

## Alternatives considered

- **Keep registry/registry checks as-is** — rejected: it is how the live bug survived.
- **Fetch Temml from CDN at test time** — rejected: network-dependent tests, non-deterministic.
- **Test the HTML↔registry key contract only** (no TeX parsing) — rejected: TeX typos would
  still only fail in someone's browser.
- **Inline the registry into HTML** — rejected for now: heavier HTML, and the TeX strings
  are shared contract for the node tests either way (revisit only if equations↔prose
  locality becomes a real pain).

## Consequences

- A typo'd `data-eq` or broken TeX fails `node tests.js` with the offending key named.
- CDN outage degrades to readable TeX + console warnings, not blank panels.
- The adapter seam has exactly one production adapter (browser Temml); the Node
  `renderToString` path is the second consumer of the same data, which is what makes the
  seam real rather than hypothetical.
- Known environment constraint, documented: Temml's DOM path (`render` → `toNode`→ `.style`)
  fails in jsdom (MathML nodes lack `.style`) — real browsers are unaffected; DOM-emulator
  smokes must inject a stub adapter through `setAdapter`, which is also how the seam gets
  exercised in CI-adjacent scripts.
