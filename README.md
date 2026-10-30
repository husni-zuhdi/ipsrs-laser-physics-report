# Fabry–Pérot Interferometer: Modes and Stability

Laser Physics report (UJM Le Mans, 2026) with its interactive study-companion website.
The report reviews the Fabry–Pérot etalon (Airy function, FSR, finesse, resolving power),
its role as a laser resonator, longitudinal and transverse modes, cavity stability
(ray-transfer matrices and the $0 \le g_1 g_2 \le 1$ condition), and Gaussian-beam fitting —
worked through with a He–Ne laser and a semiconductor diode.

Authors: Mohammed Al-Twaity · Husni Naufal Zuhdi · Khalil Assaf

## Repository layout

| Path | Contents |
|---|---|
| `report/` | LaTeX source of the report (`Fabry-Perot Mode and Stability.tex`), figures in `images/`, and the compiled PDF |
| `website/` | Interactive companion site — vanilla JS, no build step (Temml + Plotly load from CDN) |
| `website/docs/adr/` | Architecture decision records (ADR-0001: math-rendering seam) |
| `website/docs/specs/` | Module specs (`equations-module.md`) |
| `website/CONTEXT.md` | Project glossary — domain terms and the module/seam vocabulary |

## Building the report

With `latexmk` (recommended — it handles the extra passes TikZ/pgfplots need):

```sh
latexmk -pdf "report/Fabry-Perot Mode and Stability.tex"
```

Fallback without `latexmk`:

```sh
pdflatex "report/Fabry-Perot Mode and Stability.tex"   # repeat 2–3× so TikZ figures and refs settle
```

## Running the website

No build step. Open directly:

```sh
open website/index.html        # or just double-click it
```

Or serve it locally (nicer references/canvas behavior):

```sh
npx serve website
```

## Testing

```sh
cd website
npm install   # jsdom + temml, test-only dependencies
npm test
```

- `node tests.js` — physics functions, equation contract, TeX parsing
- `node tests-ui.js` — UI wiring under jsdom

The sidebar **▶ Run tests** button replays a curated subset in the browser.

## Architecture at a glance

- **`js/physics.js`** — the deep calculation module: pure functions, no DOM, dual export (Node tests + `window.FP`). All math lives here.
- **`js/equations.js`** — registry of TeX equations + rendering behind an adapter seam (Temml in the browser, `renderToString` as test adapter); owns numbering and failure policy.
- **`js/widgets.js`** — UI wiring: read controls → `physics.js` → views (canvas, Plotly, Temml).
- **Conventions** — SI units inside modules (UI converts to display units), CSS custom properties for theming (light default, `data-theme="dark"`).

See `website/CONTEXT.md` for the full glossary and `website/docs/` for the ADR and spec.
