# Spec: Equations module (`js/equations.js`)

Decision: [ADR-0001](../adr/0001-deepen-math-rendering-seam.md) ·
Glossary: [CONTEXT.md](../../CONTEXT.md) ·
Status: implemented, verified 30 Oct 2026

## Purpose

One deep module owning everything about rendering the physics equations of the report:
the registry of TeX sources, static display equations, live (control-bound) panels,
equation numbering, and the failure policy. Nothing else on the page manipulates
math-rendering libraries directly.

## Interface

```js
Equations.define(key, tex)          // register one TeX string (string must parse; enforced by tests)
Equations.defineAll(defs)           // register a { key: tex } map (used at load)
Equations.get(key) -> tex | undefined
Equations.keys() -> string[]        // registry keys, today: 32 static entries
Equations.render(el, tex, displayMode, key?) -> { ok: boolean, reason?: string }
Equations.renderAll(doc?) -> { count, failures: [{key, reason}] }
Equations.setAdapter(adapter?)      // swap the adapter behind the seam (see below)
```

### Contract notes

- `render` clears `el` before rendering; a failed render leaves readable raw TeX — never
  an empty or broken element.
- `renderAll` numbers equations `(n)` in document order and appends the `<span class="eqno">`
  itself; callers never handle numbering.
- A `data-eq` key missing from the registry is a **loud** failure: on-page placeholder,
  `console.warn`, and entry in `failures`. It is also caught by the contract test in Node.

## Adapter seam

An adapter is `{ name, render(el, tex, displayMode) }`:

```js
Equations.setAdapter({
  name: 'stub',
  render: function (el, tex, displayMode) { el.innerHTML = '<math></math>'; }
});
```

- **Default adapter**: auto-discovers `window.temml` (Temml 0.11.3 dist UMD; note lowercase
  global) and calls `render(tex, el, { displayMode, throwOnError: false })`.
- **Test adapter (Node)**: wraps `Temml.renderToString` — DOM-free path used by `tests.js`.
- Two consumers of the same registry justify the seam.
- Callers may call `setAdapter()` with `null` to reset to auto-discovery.

## Failure policy (decided, do not silently change to "catch and ignore")

| Failure | Visible surface | Console | Test surface |
|---|---|---|---|
| Temml missing (CDN outage) | Stable TeX text preview | `console.warn` (reason: `library-unavailable`) | Node: `contract test` still propagates locally; constant reminder during smoke test |
| TeX fails parsing (Temml `temml-error` span detected) | Stable TeX text preview replaced by fallback code text, `tex-fallback` styling applied | `console.warn` (reason: `parse-error`) | Node `tex-parse` test fails with the equation key named |
| `render()` throws or produces no MathML | Stable TeX text preview replaced by fallback code text, `tex-fallback` styling applied | `console.warn` (reason: `render-error`) | Node `tex-parse`/smoke tests surface the reason |
| Missing registry key | On-page placeholder text naming the key | `console.warn` (reason: `missing-key`) | Node: contract test fails both directions |

## Test surface (in `tests.js`)

1. **Contract test** — reads `index.html`, cross-checks both directions of the
   `data-eq` ↔ registry relation and asserts sizes match. The HTML↔JS id contract is a
   tested interface, not a string convention.
2. **Math-parse test** — through the devDependency (`npm install` once), every registered
   TeX renders via `renderToString`, asserting `<math` present and no `temml-error`.
3. The 79 physics checks are untouched by this module (they live behind `physics.js`).

## Invariants

- All numbering is assigned by `renderAll` in document order; widget code does not renumber.
- TeX strings are the single source: exactly one copy of each equation, keyed.
- The module is dependency-free apart from the injected adapter; no imports of `physics.js`.
- Script order in `index.html`: `physics.js` → `equations.js` → `widgets.js` (defer).
- `widgets.js` tolerates a missing `equations.js` with a no-op fallback (TeX as plain text),
  but this is a degraded last resort, not a supported configuration.

## Verification evidence (30 Oct 2026)

- `node tests.js`: **116 passed, 0 failed** (79 physics + 6 contract + 31 math-parse/adapter).
- jsdom smoke with stub adapter: 32/32 static equations numbered+rendered, live Airy panel
  rendered through `Equations.render`, zero console warnings.
- jsdom fallback probe (simulated Temml DOM-path failure): TeX text kept, `tex-fallback`
  class applied, `console.warn` raised with key + reason.
- Real-browser note: Temml's DOM path works in browsers; the jsdom-only failure reported in
  the review is an emulator limitation (MathML `.style`), not a site defect.
