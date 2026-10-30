# CONTEXT.md — Fabry–Pérot Website

The ubiquitous language of this project. Module names and seams below are the vocabulary
used in architecture reviews, specs and ADRs — use these terms, don't invent synonyms.

## Domain (physics) glossary

| Term | Meaning |
|---|---|
| **Etalon** | Two parallel partially-reflecting surfaces separated by distance d; the passive interferometer |
| **Cavity** | The same structure acting as a laser resonator (mirrors may be curved, radii R<sub>c1</sub>, R<sub>c2</sub>) |
| **Airy function** | Transmission I_t/I₀ = (T²/(1−R)²)·1/(1+F·sin²(δ/2)) of the etalon |
| **FSR (Δν<sub>FSR</sub>)** | Free spectral range c/2nd — spacing between successive resonances |
| **Finesse 𝓕** | FSR divided by peak width: π√R/(1−R); depends only on mirror quality |
| **Order m** | Integer at resonance: 2nd·cosθ = mλ |
| **g-parameters** | gᵢ = 1 − L/R<sub>ci</sub>; stability is 0 ≤ g₁g₂ ≤ 1 |
| **Stability diagram** | The (g₁, g₂) plane; stable region between axes and hyperbola g₁g₂ = 1 |
| **TEM<sub>lm</sub>** | Hermite–Gaussian transverse mode; l, m count nodal lines on x, y |
| **Waist w₀ / Rayleigh range z_R** | Minimum beam radius and πw₀²/λ |
| **Gouy phase ζ** | arctan(z/z_R); cavity Δζ = arccos(±√(g₁g₂)) separates transverse-mode frequencies |
| **Mode comb** | Longitudinal modes under the gain curve; spacing FSR, oscillating when gain > threshold |

## Architecture glossary (modules & seams)

| Term | Meaning |
|---|---|
| **physics.js** | THE deep calculation module: pure functions, no DOM, dual export (Node + `window.FP`). All math lives here. |
| **Equations module** | `js/equations.js`: registry of TeX equations + rendering behind an adapter seam. Owns numbering, failure policy. See `docs/specs/equations-module.md`, ADR-0001. |
| **widgets.js** | The UI module: wires controls → physics.js → views (canvas/Plotly/Temml via seams). A widget means: "read inputs, compute, hand results to seams". |
| **Adapter** | A concrete renderer behind a seam. Today: Temml browser adapter on the Equations seam (node `renderToString` adapter is the test adapter); Plotly behind the plot call path; raw 2D contexts behind canvas widgets. |
| **Live equation panel** | A formula that re-renders when controls change (currently the Airy panel); values come from widgets, TeX from the Equations module. |

## Conventions

- Units are SI inside modules; UI layer converts display units (cm, µm, GHz, nm) at control-read time (see ADR-0004 candidate C if this is deepened into a spec table).
- Theme: CSS custom properties are the source of truth; light default, `data-theme="dark"`.
- Verification: `node tests.js` (physics + equation contract + TeX parse). The sidebar button replays a curated subset in-browser.
