'use strict';

const fs = require('fs');
const path = require('path');

const FP = require('./js/physics.js');
const Equations = require('./js/equations.js');

let passed = 0, failed = 0;

function close(name, actual, expected, relTol) {
  relTol = relTol || 1e-6;
  const denom = Math.max(Math.abs(expected), 1e-300);
  const err = Math.abs(actual - expected) / denom;
  if (err <= relTol) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL ${name}: got ${actual}, expected ${expected} (rel err ${err.toExponential(2)})`);
  }
}

function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error(`FAIL ${name}`); }
}


const c = FP.C;

// ---- Etalon: finesse & FSR (report Sec. 2.5 numerical example) ----
close('finesse R=0.3', FP.finesse(0.3), Math.PI * Math.sqrt(0.3) / 0.7, 1e-9);
close('finesse R=0.9 ~ 30', FP.finesse(0.9), 29.8063, 1e-4);
close('FSR 1 mm fused silica ~103 GHz', FP.fsrHz(1e-3, 1.45), 103.377e9, 1e-4);
close('FSR d(lambda) form', FP.deltaLambdaFSR(632.8e-9, 1e-3, 1.45), (632.8e-9 ** 2) / (2 * 1.45 * 1e-3));
close('peak transmission lossless', FP.peakTransmission(0.9, 0), 1);
close('peak transmission A=0.05 -> [1-A/(1-R)]^2 = 0.25', FP.peakTransmission(0.9, 0.05), 0.25, 1e-9);
close('min transmission R=0.9', FP.minTransmission(0.9), Math.pow(0.1 / 1.9, 2));
close('airy peak at delta=2pi m', FP.airy(0.9, 2 * Math.PI * 2), 1);
{
  const F = FP.finesseCoefficient(0.6);
  const dHalf = 2 * Math.asin(1 / Math.sqrt(F));
  close('airy at exact half max', FP.airy(0.6, dHalf), 0.5, 1e-9);
  close('F coefficient R=0.6', F, 15, 1e-9);
}
close('airy denominator form', FP.airy(0.9, Math.PI / 2), 1 / (1 + FP.finesseCoefficient(0.9) * 0.5));

// resolving power: (2nd/lambda)·F at 632.8 nm
{
  const expected = (2 * 1.45 * 1e-3 / 632.8e-9) * FP.finesse(0.9);
  close('resolving power ~1.37e5 (report: ~1.4e5)', FP.resolvingPower(1e-3, 1.45, 632.8e-9, 0.9), expected, 1e-12);
  check('resolving power order 1.4e5', FP.resolvingPower(1e-3, 1.45, 632.8e-9, 0.9) > 1.3e5 && FP.resolvingPower(1e-3, 1.45, 632.8e-9, 0.9) < 1.5e5);
}

// phase difference / order at normal incidence
close('order m ~4.6e3', FP.orderNumber(1e-3, 1.45, 0, 632.8e-9), 4582.8, 1e-3);

// ---- Diode facet reflectivity (report Sec. 6.2) ----
close('facet R n=3.5 ~ 0.31', FP.facetReflectivity(3.5), 0.3086, 1e-3);
close('mirror loss ~39 cm^-1', Math.log(1 / 0.3086419753) / 3e-2, 39.186, 1e-4);
close('diode FSR ~125 GHz', FP.fsrCavityHz(300e-6, 4.0), 124.914e9, 1e-4);
close('diode dLambda ~0.3 nm', (850e-9 ** 2) * FP.fsrCavityHz(300e-6, 4) / c, 0.30e-9, 3e-2);

// ---- Threshold & photon lifetime (Sec. 3.1) ----
close('threshold gain', FP.thresholdGain(0.3, 0.98, 0.95, 1e-3),
  1e-3 + Math.log(1 / (0.98 * 0.95)) / 0.6);
{
  const L = 0.3, R1 = 0.9, R2 = 0.9, alpha0 = 0;
  const tau = (2 * L) / (c * Math.log(1 / (R1 * R2)));
  close('photon lifetime consistency', FP.photonLifetime(L, 1, R1, R2, alpha0), tau);
  const fin = FP.finesse(R1);
  close('linewidth ~ FSR/fin (R->1 asymptote)', FP.cavityLinewidth(FP.photonLifetime(L, 1, R1, R2, alpha0)), (c / (2 * L)) / fin, 6e-4);
}

// ---- g-parameters & stability ----
close('g plano-concave HeNe', FP.gParam(0.3, Infinity), 1);
close('g2 HeNe', FP.gParam(0.3, 0.5), 0.4);
check('stable HeNe', FP.isStable(1, 0.4));
check('unstable g<0', !FP.isStable(1, -0.4));
check('plane-plane marginal stable', FP.isStable(1, 1));
check('confocal stable', FP.isStable(0, 0));
check('g1g2>1 unstable', !FP.isStable(1, 2));

// ---- Delta zeta (Sec. 4.2 Step 7) ----
close('dzeta plano-concave = arccos sqrt(0.4)', FP.deltaZeta(1, 0.4), Math.acos(Math.sqrt(0.4)), 1e-9);
close('dzeta/pi ~ 0.282', FP.deltaZeta(1, 0.4) / Math.PI, 0.28212, 1e-3);
close('dzeta confocal = pi/2', FP.deltaZeta(0, 0), Math.PI / 2);
close('dzeta concentric = pi', FP.deltaZeta(-1, -1), Math.PI);
close('dzeta plane-plane = 0', FP.deltaZeta(1, 1), 0);
close('transverse spacing HeNe ~141MHz',
  FP.transverseSpacing(FP.fsrCavityHz(0.3, 1), FP.deltaZeta(1, 0.4)), 141.0e6, 6e-3);
close('dzeta near-concentric = arccos(-|g|)', FP.deltaZeta(-0.2, -0.2), Math.acos(-0.2), 1e-9);

// confocal interleave: spectrum uniformly spaced by nuF/2 = c/4L
{
  const L = 0.3, nuF = c / (2 * L);
  const dz = FP.deltaZeta(0, 0);
  close('confocal even N halfway', FP.modeFrequency(0, 0, nuF, dz), 0.5 * nuF, 1e-9);
  close('confocal odd N on comb', FP.modeFrequency(0, 1, nuF, dz), nuF, 1e-9);
  close('c/4L confocal spacing', FP.confocalFSR(L), nuF / 2, 1e-9);
}

// ---- Cavity matching (Sec. 4.2 Step 6, Eq. 26) ----
{
  const L = 0.3, Rc2 = 0.5;
  const m = FP.cavityMatching(L, Infinity, Rc2);
  close('HeNe zR ~0.245', m.zR, 0.2449489743, 1e-5);
  close('HeNe zR = sqrt(L(Rc-L))', m.zR, Math.sqrt(L * (Rc2 - L)), 1e-9);
  close('HeNe z1 = 0', m.z1, 0, 1e-12);
  close('HeNe z2 = L', m.z2, L, 1e-9);
  const lambda = 632.8e-9;
  const w0 = FP.waistFromZR(lambda, m.zR);
  const w0direct = Math.sqrt((lambda / Math.PI) * Math.sqrt(L * (Rc2 - L)));
  close('HeNe w0 direct', w0, w0direct, 1e-9);
  close('HeNe w0 ~0.22 mm', w0, 2.21e-4, 1e-2);
  const w2 = FP.spotSize(w0, m.zR, L);
  close('HeNe w2 ~0.35 mm', w2, 3.51e-4, 1e-2);
  close('HeNe divergence ~0.9 mrad', FP.divergenceAngle(lambda, w0), 9.07e-4, 5e-3);
}

// symmetric cavity
{
  const L = 0.4, Rc = 0.6, lambda = 1064e-9;
  const m = FP.cavityMatching(L, Rc, Rc);
  const s = FP.symmetricCavity(L, Rc, lambda);
  close('symm zR formula', m.zR, s.zR, 1e-9);
  close('symm z1=-L/2', m.z1, -L / 2, 1e-9);
  close('symm z2=+L/2', m.z2, L / 2, 1e-9);
  close('symm w0 match', s.w0, FP.waistFromZR(lambda, m.zR), 1e-9);
  close('symm w1 = spot at z=L/2', s.w1, FP.spotSize(s.w0, s.zR, L / 2), 1e-9);
}

// symmetric confocal
{
  const L = 0.5;
  const m = FP.cavityMatching(L, L, L);
  close('confocal zR = L/2', m.zR, 0.25, 1e-9);
  close('confocal z1', m.z1, -L / 2, 1e-9);
  close('confocal z2', m.z2, L / 2, 1e-9);
}

// near-concentric symmetric: stable with both g < 0
{
  const L = 0.3, Rc = 0.25;
  const m = FP.cavityMatching(L, Rc, Rc);
  check('near-concentric stable', m.stable);
  close('near-concentric zR', m.zR, Math.sqrt(L * (2 * Rc - L) / 4), 1e-9);
}

// unstable cavities return NaN
{
  const m = FP.cavityMatching(0.3, 0.25, 10);
  check('unstable asymmetric detected', !FP.isStable(m.g1, m.g2));
  check('unstable -> NaN zR', Number.isNaN(m.zR));
}

// ---- modeComb: HeNe 1.5 GHz gain, ~500 MHz FSR -> 3 modes above threshold 0.5 ----
{
  const comb = FP.modeComb(0.3, 1, 1.5e9, 0.5);
  close('HeNe comb count = 3', comb.count, 3, 1e-9);
  close('comb FSR', comb.nuFSR, c / (0.6), 1e-9);
  const combLong = FP.modeComb(0.3, 1, 1.5e9, 0.2);
  close('count grows at low threshold', combLong.count, 5, 1e-9);
}

// ---- Hermite polynomials & nodal roots ----
close('H0', FP.hermite(0, 9.9), 1);
close('H1(1.5)', FP.hermite(1, 1.5), 3);
close('H2(2)', FP.hermite(2, 2), 14);
close('H3(2)', FP.hermite(3, 2), 40);
{
  const r1 = FP.hgRoots(1);
  close('H1 root', r1[0], 0, 1e-9);
  const r2 = FP.hgRoots(2);
  close('H2 roots', r2[0], -Math.SQRT1_2, 1e-4);
  close('H2 roots b', r2[1], Math.SQRT1_2, 1e-4);
  const r3 = FP.hgRoots(3);
  close('H3 root count', r3.length, 3, 1e-9);
  close('H3 mid root', r3[1], 0, 1e-4);
  close('H3 outer |root| = sqrt(3/2)', Math.abs(r3[2]), Math.sqrt(1.5), 1e-3);
  const r4 = FP.hgRoots(4);
  close('H4 root count', r4.length, 4, 1e-9);
  const r0 = FP.hgRoots(0);
  close('H0 no roots', r0.length, 0, 1e-9);
}

// ---- HG profile ----
close('HG 00 on axis', FP.hgProfileUV(0, 0, 0, 0), 1);
close('HG 10 zero at x=0', FP.hgProfileUV(1, 0, 0, 0), 0);
close('HG 20 value at x=0', FP.hgProfileUV(2, 0, 0, 0), -2);
close('HG symmetric', FP.hgProfileUV(3, 1, 0.2, 0.3), FP.hgProfileUV(1, 3, 0.3, 0.2), 1e-12);

// ---- Gaussian gain profile: FWHM convention ----
close('gain at HWHM edge = 0.5', FP.gainProfile(0.75e9, 1.5e9), 0.5, 1e-9);
close('gain on axis = 1', FP.gainProfile(0, 1.5e9), 1);

// ---- Equations module: HTML <-> registry contract ----
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const used = [...new Set((html.match(/data-eq="([^"]+)"/g) || []).map(m => m.slice(9, -1)))];
const defined = Equations.keys();
const missing = used.filter(k => !Equations.get(k));
const unused = defined.filter(k => !used.includes(k));
check('registry is non-empty', defined.length > 0);
check('all data-eq keys in HTML are registered: ' + (missing.join(', ') || 'none'), missing.length === 0);
check('all registered keys are used in HTML: ' + (unused.join(', ') || 'none'), unused.length === 0);
check('registry size matches HTML usage', used.length === defined.length);

// ---- Equations module: every registered TeX parses to MathML (via temml devDependency) ----
let temml = null;
try {
  temml = require('temml');
} catch (e) {
  console.error('NOTE temml not installed — math-parse checks skipped (run: npm install)');
}
if (temml && typeof temml.renderToString === 'function') {
  defined.forEach(k => {
    let out = null;
    try {
      out = temml.renderToString(Equations.get(k), { displayMode: true, throwOnError: false });
    } catch (e) {
      failed++;
      console.error(`FAIL tex-parse ${k}: threw ${e.message}`);
      return;
    }
    check(`tex-parse ${k}`, typeof out === 'string' && out.includes('<math') && !out.includes('temml-error'));
  });
  check('adapter seam present (setAdapter)', typeof Equations.setAdapter === 'function');
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
