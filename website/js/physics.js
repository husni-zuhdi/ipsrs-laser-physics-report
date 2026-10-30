(function (global) {
  'use strict';

  var C = 299792458;

  function finesseCoefficient(R) {
    return (4 * R) / Math.pow(1 - R, 2);
  }

  function airy(R, delta) {
    var F = finesseCoefficient(R);
    return 1 / (1 + F * Math.pow(Math.sin(delta / 2), 2));
  }

  function peakTransmission(R, A) {
    var T = 1 - R - A;
    return (T * T) / Math.pow(1 - R, 2);
  }

  function minTransmission(R) {
    var t = (1 - R) / (1 + R);
    return t * t;
  }

  function finesse(R) {
    return Math.PI * Math.sqrt(R) / (1 - R);
  }

  function fsrHz(d, n) {
    return C / (2 * n * d);
  }

  function fsrCavityHz(L, n) {
    return C / (2 * n * L);
  }

  function deltaLambdaFSR(lambda, d, n) {
    return (lambda * lambda) / (2 * n * d);
  }

  function phaseDifference(d, n, theta, lambda) {
    return (4 * Math.PI * n * d * Math.cos(theta)) / lambda;
  }

  function orderNumber(d, n, theta, lambda) {
    return (2 * n * d * Math.cos(theta)) / lambda;
  }

  function resolvingPower(d, n, lambda, R) {
    return (2 * n * d) / lambda * finesse(R);
  }

  function facetReflectivity(n) {
    var r = (n - 1) / (n + 1);
    return r * r;
  }

  function thresholdGain(L, R1, R2, alpha) {
    return alpha + (1 / (2 * L)) * Math.log(1 / (R1 * R2));
  }

  function roundTripLoss(L, R1, R2, alpha) {
    return 2 * alpha * L + Math.log(1 / (R1 * R2));
  }

  function photonLifetime(L, n, R1, R2, alpha) {
    return (2 * n * L) / (C * roundTripLoss(L, R1, R2, alpha));
  }

  function cavityLinewidth(tau) {
    return 1 / (2 * Math.PI * tau);
  }

  function gParam(L, Rc) {
    if (!isFinite(Rc)) return 1;
    return 1 - L / Rc;
  }

  function isStable(g1, g2) {
    var p = g1 * g2;
    return p >= 0 && p <= 1;
  }

  function deltaZeta(g1, g2) {
    var p = g1 * g2;
    if (p < 0 || p > 1) return NaN;
    var sign = (g1 > 0 && g2 > 0) ? 1 : -1;
    return Math.acos(sign * Math.sqrt(p));
  }

  function cavityMatching(L, Rc1, Rc2) {
    var g1 = gParam(L, Rc1);
    var g2 = gParam(L, Rc2);
    var out = {
      g1: g1, g2: g2,
      stable: isStable(g1, g2),
      zR: NaN, z1: NaN, z2: NaN
    };
    if (!out.stable) return out;

    var a = Rc1, b = Rc2;
    var bothInf = !isFinite(a) && !isFinite(b);
    var bothNearL = isFinite(a) && isFinite(b) &&
      Math.abs(a + b - 2 * L) < 1e-12 * Math.max(1, L);

    if (bothInf) {
      out.zR = Infinity;
      return out;
    }
    if (bothNearL) {
      out.zR = L / 2;
      out.z1 = -L / 2;
      out.z2 = L / 2;
      return out;
    }

    var denom = a + b - 2 * L;
    if (isFinite(a) && isFinite(b)) {
      out.zR2 = (L * (a - L) * (b - L) * (a + b - L)) / (denom * denom);
      out.zR = Math.sqrt(out.zR2);
      out.z1 = (-L * (b - L)) / denom;
      out.z2 = (L * (a - L)) / denom;
    } else {
      var Rc = isFinite(a) ? a : b;
      out.zR = Math.sqrt(L * (Rc - L));
      if (!isFinite(a)) {
        out.z1 = 0;
        out.z2 = L;
      } else {
        out.z1 = -L;
        out.z2 = 0;
      }
    }
    return out;
  }

  function waistFromZR(lambda, zR) {
    return Math.sqrt((lambda * zR) / Math.PI);
  }

  function spotSize(w0, zR, z) {
    return w0 * Math.sqrt(1 + (z / zR) * (z / zR));
  }

  function wavefrontRadius(z, zR) {
    return z * (1 + (zR / z) * (zR / z));
  }

  function divergenceAngle(lambda, w0) {
    return lambda / (Math.PI * w0);
  }

  function rayleighFromWaist(w0, lambda) {
    return (Math.PI * w0 * w0) / lambda;
  }

  function symmetricCavity(L, Rc, lambda) {
    var g = 1 - L / Rc;
    var w0_2 = (lambda * L) / (2 * Math.PI) * Math.sqrt((1 + g) / (1 - g));
    var w1_2 = (lambda * L) / Math.PI * (1 / Math.sqrt(1 - g * g));
    return {
      g: g,
      z1: L / 2,
      zR: Math.sqrt(L * (2 * Rc - L) / 4),
      w0: Math.sqrt(w0_2),
      w1: Math.sqrt(w1_2)
    };
  }

  function waistZ1distance(L, g1, g2) {
    var denom = g1 + g2 - 2 * g1 * g2;
    return (L * g2 * (1 - g1)) / denom;
  }

  function modeFrequency(q, NOrder, nuFSR, dzeta) {
    return q * nuFSR + (dzeta / Math.PI) * (NOrder + 1) * nuFSR;
  }

  function transverseSpacing(nuFSR, dzeta) {
    return (dzeta / Math.PI) * nuFSR;
  }

  function confocalFSR(L) {
    return C / (4 * L);
  }

  function gainProfile(deltaNu, fwhm) {
    var sigma = fwhm / (2 * Math.sqrt(2 * Math.log(2)));
    return Math.exp(-0.5 * (deltaNu * deltaNu) / (sigma * sigma));
  }

  function modeComb(L, n, fwhmGain, threshold) {
    var nuF = fsrCavityHz(L, n);
    var modes = [];
    var N = 0;
    var half = 8;
    for (var i = -half; i <= half; i++) {
      var g = gainProfile(i * nuF, fwhmGain);
      var osc = g > threshold;
      if (osc) N++;
      modes.push({ index: i, gain: g, oscillating: osc, deltaNu: i * nuF });
    }
    modes = modes.filter(function (m) {
      return Math.abs(m.deltaNu) <= Math.max(nuF, 2.5 * fwhmGain);
    });
    return { nuFSR: nuF, modes: modes, count: N };
  }

  function hermite(n, x) {
    if (n === 0) return 1;
    if (n === 1) return 2 * x;
    var prev = 1, cur = 2 * x;
    for (var k = 1; k < n; k++) {
      var next = 2 * x * cur - 2 * k * prev;
      prev = cur;
      cur = next;
    }
    return cur;
  }

  function hgRoots(n) {
    var roots = [];
    if (n === 0) return roots;
    var bound = Math.sqrt(2 * n + 2);
    var steps = 4000;
    var prevX = -bound, prevV = hermite(n, prevX);
    for (var i = 1; i <= steps; i++) {
      var x = -bound + (2 * bound * i) / steps;
      var v = hermite(n, x);
      if (prevV === 0) roots.push(prevX);
      else if (prevV * v < 0) {
        var lo = prevX, hi = x, flo = prevV;
        for (var j = 0; j < 60; j++) {
          var mid = 0.5 * (lo + hi);
          var fm = hermite(n, mid);
          if (flo * fm < 0) { hi = mid; }
          else { lo = mid; flo = fm; }
        }
        roots.push(0.5 * (lo + hi));
      }
      prevX = x; prevV = v;
    }
    return roots;
  }

  function hgProfileUV(l, m, xn, yn) {
    var He = hermite(l, xn) * hermite(m, yn);
    var gauss = Math.exp(-(xn * xn + yn * yn));
    return He * gauss;
  }

  var api = {
    C: C,
    finesseCoefficient: finesseCoefficient,
    airy: airy,
    peakTransmission: peakTransmission,
    minTransmission: minTransmission,
    finesse: finesse,
    fsrHz: fsrHz,
    fsrCavityHz: fsrCavityHz,
    deltaLambdaFSR: deltaLambdaFSR,
    phaseDifference: phaseDifference,
    orderNumber: orderNumber,
    resolvingPower: resolvingPower,
    facetReflectivity: facetReflectivity,
    thresholdGain: thresholdGain,
    roundTripLoss: roundTripLoss,
    photonLifetime: photonLifetime,
    cavityLinewidth: cavityLinewidth,
    gParam: gParam,
    isStable: isStable,
    deltaZeta: deltaZeta,
    cavityMatching: cavityMatching,
    waistFromZR: waistFromZR,
    spotSize: spotSize,
    wavefrontRadius: wavefrontRadius,
    divergenceAngle: divergenceAngle,
    rayleighFromWaist: rayleighFromWaist,
    symmetricCavity: symmetricCavity,
    waistZ1distance: waistZ1distance,
    modeFrequency: modeFrequency,
    transverseSpacing: transverseSpacing,
    confocalFSR: confocalFSR,
    gainProfile: gainProfile,
    modeComb: modeComb,
    hermite: hermite,
    hgRoots: hgRoots,
    hgProfileUV: hgProfileUV
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.FP = api;

})(typeof window !== 'undefined' ? window : this);
