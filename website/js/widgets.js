(function () {
  'use strict';

  var FP = window.FP;
  var Theme = window.Theme || {
    palette: function () { return { fg: '#1c2024', soft: '#5a626b', grid: '#e3e6ea', accent: '#1a4d8f', warn: '#a33b3b', dark: false }; },
    subscribe: function () { return function () { }; },
    init: function () { }
  };
  var Equations = window.Equations || {
    defineAll: function () { },
    renderAll: function () { },
    render: function (el, tex) { if (el) el.textContent = tex; }
  };
  var $ = function (id) { return document.getElementById(id); };
  var C = 299792458;

  function fmt(v, d) {
    if (!isFinite(v)) return '∞';
    if (v === 0) return '0';
    return v.toPrecision(d || 3);
  }

  function fmtHz(v) {
    if (!isFinite(v)) return '∞';
    if (v >= 1e9) return fmt(v / 1e9, 3) + ' GHz';
    if (v >= 1e6) return fmt(v / 1e6, 3) + ' MHz';
    if (v >= 1e3) return fmt(v / 1e3, 3) + ' kHz';
    return fmt(v, 3) + ' Hz';
  }

  function fmtLength(v) {
    if (!isFinite(v)) return '∞';
    if (Math.abs(v) >= 1) return fmt(v, 4) + ' m';
    if (Math.abs(v) >= 1e-3) return fmt(v * 1e3, 3) + ' mm';
    if (Math.abs(v) >= 1e-6) return fmt(v * 1e6, 3) + ' µm';
    return fmt(v * 1e9, 3) + ' nm';
  }

  function fmtAngle(v) {
    if (!isFinite(v)) return '—';
    if (Math.abs(v) >= 0.02) return fmt(v, 3) + ' rad';
    return fmt(v * 1e3, 3) + ' mrad';
  }

  function hexToRgba(hex, alpha) {
    var h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function noopCtx() {
    var stub = {};
    ['setTransform', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'fillRect',
      'strokeRect', 'arc', 'closePath', 'fillText', 'drawImage', 'putImageData', 'save',
      'restore', 'setLineDash', 'createImageData'].forEach(function (m) {
      stub[m] = function () { return { data: [] }; };
    });
    return stub;
  }

  function safeCtx(canvas) {
    try {
      return canvas.getContext('2d') || noopCtx();
    } catch (e) {
      return noopCtx();
    }
  }

  var PLOT_CONFIG = { displayModeBar: false, responsive: true };

  function baseLayout(pal, extra) {
    var lay = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: pal.fg, size: 12.5, family: 'system-ui, sans-serif' },
      margin: { l: 52, r: 14, t: 10, b: 40 },
      xaxis: { gridcolor: pal.grid, zerolinecolor: pal.grid },
      yaxis: { gridcolor: pal.grid, zerolinecolor: pal.grid },
      showlegend: false,
      hovermode: 'closest'
    };
    if (extra) {
      Object.keys(extra).forEach(function (key) { lay[key] = extra[key]; });
    }
    return lay;
  }

  function makePlot(elId, build, legend) {
    var el = $(elId);
    if (!el) return null;
    if (!window.Plotly) {
      el.innerHTML = '<p class="hint">Chart library (Plotly CDN) did not load — the numeric readouts on this panel stay live.</p>';
      return null;
    }
    function render() {
      var spec = build(Theme.palette());
      if (!spec) {
        el.innerHTML = '<p class="hint">No chart for the current configuration.</p>';
        return;
      }
      Plotly.react(el, spec.data, baseLayout(Theme.palette(), spec.layout), PLOT_CONFIG);
    }
    Theme.subscribe(render);
    render();
    return { render: render };
  }
  function makeCanvas(id, draw) {
    var canvas = $(id);
    if (!canvas) return null;
    var hCss = parseInt(canvas.getAttribute('data-h') || '300', 10);

    function redraw() {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth || 600;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hCss * dpr);
      canvas.style.height = hCss + 'px';
      var c2d = safeCtx(canvas);
      var pal = Theme.palette();
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2d.clearRect(0, 0, w, hCss);
      try {
        draw(c2d, w, hCss, {
          fg: pal.fg, soft: pal.soft, grid: pal.grid,
          accent: pal.accent, warn: pal.warn, dark: pal.dark
        });
      } catch (e) {
        console.error('[widgets] canvas "' + id + '" draw failed:', e);
        c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        c2d.fillStyle = pal.warn;
        c2d.font = '12px system-ui';
        c2d.fillText('This canvas could not be drawn: ' + e.message, 10, 20);
      }
    }

    Theme.subscribe(redraw);
    if (window.ResizeObserver) {
      new ResizeObserver(function () { redraw(); }).observe(canvas);
      if (canvas.parentElement) new ResizeObserver(function () { redraw(); }).observe(canvas.parentElement);
    }
    redraw();
    return { redraw: redraw };
  }

  function initRays() {
    if (!$('canvas-rays')) return;
    var dWorld = 100;
    var t = 25 / 180 * Math.PI;
    var nIdx = 1.45;
    var progress = 0;
    var lastTime = null;

    function buildPath() {
      var tanT = Math.tan(t);
      var arr = [];
      for (var k = 0; k <= 6; k++) {
        arr.push({
          x: (k % 2 === 0) ? 0 : dWorld,
          y: k * dWorld * tanT
        });
      }
      return arr;
    }

    var boundary = null;

    function draw(c2d, w, hh, cols) {
      var path = buildPath();
      var maxTop = path[path.length - 1].y;
      var needed = maxTop + 0.9 * dWorld;
      var s = Math.min(0.9, (hh * 0.40) / Math.max(needed, 1));
      var baseY = hh - 0.22 * hh;
      var xOff = 0.16 * w;
      var perUnit = (0.35 * w) / dWorld * 1.9;

      function TX(p) {
        return { x: xOff + p.x * perUnit, y: baseY - p.y * s };
      }
      boundary = TX;

      var plX = TX({ x: 0, y: 0 }).x;
      var plX2 = TX({ x: dWorld, y: 0 }).x;
      var plateTop = 0.08 * hh;
      var plateBottom = hh - 0.12 * hh;

      function plate(px) {
        c2d.fillStyle = cols.accent;
        c2d.globalAlpha = 0.15;
        c2d.fillRect(px - 4, plateTop, 8, plateBottom - plateTop);
        c2d.globalAlpha = 1;
        c2d.strokeStyle = cols.soft;
        c2d.strokeRect(px - 4, plateTop, 8, plateBottom - plateTop);
      }

      function arrow(x1, y1, x2, y2, color, alpha, lw) {
        c2d.save();
        c2d.globalAlpha = alpha === undefined ? 1 : alpha;
        c2d.strokeStyle = color;
        c2d.fillStyle = color;
        c2d.lineWidth = lw || 1.4;
        c2d.beginPath();
        c2d.moveTo(x1, y1);
        c2d.lineTo(x2, y2);
        c2d.stroke();
        var ang = Math.atan2(y2 - y1, x2 - x1);
        c2d.beginPath();
        c2d.moveTo(x2, y2);
        c2d.lineTo(x2 - 7 * Math.cos(ang - 0.4), y2 - 7 * Math.sin(ang - 0.4));
        c2d.lineTo(x2 - 7 * Math.cos(ang + 0.4), y2 - 7 * Math.sin(ang + 0.4));
        c2d.closePath();
        c2d.fill();
        c2d.restore();
      }

      var p0 = TX(path[0]);
      var dirIn = { x: Math.cos(t), y: Math.sin(t) };
      var theta0 = Math.asin(Math.min(1, nIdx * Math.sin(t)));

      plate(plX);
      plate(plX2);

      var a0 = { x: p0.x - 60 * dirIn.x, y: p0.y - 60 * dirIn.y };
      arrow(a0.x, a0.y, p0.x, p0.y, cols.warn, 1, 1.6);
      c2d.fillStyle = cols.soft;
      c2d.font = '11px system-ui';
      c2d.fillText('E₀', a0.x - 24, a0.y - 4);
      c2d.fillText('θ₀ (external)', a0.x + 6, plateBottom - 26);

      var segLen = dWorld / Math.cos(t);
      var u = progress * segLen;
      var labels = ['A', 'B', 'C', 'D'];

      function drawSegArrow(from, to, segIdx) {
        arrow(from.x, from.y, to.x, to.y, cols.warn, 1, 1.6);
        var pi = segIdx - 1;
        if (pi < labels.length) {
          c2d.fillStyle = cols.fg;
          c2d.fillText(labels[pi], from.x - (from.x < plX2 * 0.5 ? 14 : -6), from.y - 4);
        }
        if (to.x >= plX2 - 0.5 && segIdx % 2 === 1) {
          var kOut = (segIdx - 1) / 2;
          var amp = Math.pow(0.55, kOut);
          var len = perUnit * 0.75 * dWorld;
          if (kOut === 1) len *= 1.25;
          arrow(to.x, to.y, to.x + len * Math.cos(t), to.y - len * Math.sin(t), cols.warn, 0.25 + 0.75 * amp, 1.6);
          if (kOut < 2) {
            c2d.fillStyle = cols.fg;
            c2d.fillText('ray ' + (kOut + 1), to.x + len * Math.cos(t) + 4, to.y - len * Math.sin(t));
          }
        }
        if (pi >= 2) {
          c2d.fillStyle = cols.soft;
          c2d.fillText('d /cosθ', (TX(path[pi - 1]).x + TX(path[pi]).x) / 2 - 18, (TX(path[pi - 1]).y + TX(path[pi]).y) / 2);
        }
      }

      for (var seg = 0; seg < 6; seg++) {
        if (u <= seg * segLen) break;
        var frac = Math.min(1, (u - seg * segLen) / segLen);
        drawSegArrow(TX(path[seg]), { x: TX(path[seg]).x + (TX(path[seg + 1]).x - TX(path[seg]).x) * frac, y: TX(path[seg]).y + (TX(path[seg + 1]).y - TX(path[seg]).y) * frac }, seg + 1);
      }

      c2d.strokeStyle = cols.soft;
      c2d.beginPath();
      c2d.moveTo(plX, plateBottom + 4);
      c2d.lineTo(plX2, plateBottom + 4);
      c2d.stroke();
      c2d.fillStyle = cols.fg;
      c2d.fillText('d', (plX + plX2) / 2 - 4, plateBottom + 20);

      c2d.fillStyle = cols.accent;
      c2d.font = '12px system-ui';
      c2d.fillText('θ (inside) = ' + Math.round(t * 180 / Math.PI) + '°,  θ₀ = ' + Math.round(theta0 * 180 / Math.PI) + '°', 10, plateTop + 14);

      var opdUm = 2 * nIdx * 1e-6 * Math.cos(t);
      var lam = 633e-9;
      c2d.fillStyle = cols.fg;
      c2d.fillText('OPD behind ray 2: 2nd·cosθ = ' + fmt(opdUm * 1e9, 3) + ' nm (d = 1 µm) → δ/2π = ' + fmt(opdUm / lam, 3), 10, plateTop + 30);
    }

    var view = makeCanvas('canvas-rays', draw);
    if (!view) return;

    var loop = function (time) {
      if (lastTime === null) lastTime = time;
      var dt = Math.min(64, time - lastTime) / 1000;
      lastTime = time;
      progress += dt * 1.4;
      if (progress > 8) progress = 0;
      if (!document.hidden) view.redraw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    var thetaIn = $('rays-theta'), nIn = $('rays-n');
    var thetaVal = $('rays-theta-val'), nVal = $('rays-n-val');
    var opdOut = $('rays-opd');

    function sync() {
      t = parseFloat(thetaIn.value) / 180 * Math.PI;
      nIdx = parseFloat(nIn.value);
      thetaVal.textContent = thetaIn.value + '°';
      nVal.textContent = nIdx.toFixed(2);
      var sin0 = nIdx * Math.sin(t);
      var ext = sin0 <= 1 ? Math.asin(sin0) * 180 / Math.PI : NaN;
      var opd = 2 * nIdx * 1e-6 * Math.cos(t);
      if (opdOut) {
        opdOut.innerHTML =
          '<b>OPD</b> = 2nd·cosθ = <b>' + fmt(opd * 1e6, 4) + ' µm</b> (d=1 µm) → ' +
          '<b>δ/2π = ' + fmt(opd / 633e-9, 3) + '</b> orders at λ = 633 nm<br>' +
          'External angle θ₀ = arcsin(n·sinθ) = <b>' + (isNaN(ext) ? 'TIR beyond window' : fmt(ext, 3) + '°') + '</b>';
      }
    }

    thetaIn.addEventListener('input', sync);
    nIn.addEventListener('input', sync);
    sync();
  }

  function initAiry() {
    var rIn = $('airy-R'), thIn = $('airy-theta'), dIn = $('airy-d'), nIn = $('airy-n'), lamIn = $('airy-lambda');
    var rVal = $('airy-R-val'), thVal = $('airy-theta-val');
    var readout = $('airy-readout');
    var formula = $('airy-formula');
    var xs = [];
    for (var ii = 0; ii <= 600; ii++) xs.push(-0.5 + 2.5 * ii / 600);

    function build(pal) {
      var R = parseFloat(rIn.value);
      var data = [0.3, 0.65, 0.92].map(function (Rf) {
        return {
          x: xs, y: xs.map(function (x) { return FP.airy(Rf, x * 2 * Math.PI); }),
          mode: 'lines', line: { color: pal.soft, width: 1 }, hoverinfo: 'skip', showlegend: false
        };
      });
      data.push({
        x: xs, y: xs.map(function (x) { return FP.airy(R, x * 2 * Math.PI); }),
        mode: 'lines', line: { color: pal.accent, width: 2.4 }, showlegend: false,
        hovertemplate: 'δ/2π = %{x:.3f}<br>I_t/I₀ = %{y:.3f}<extra></extra>'
      });
      return {
        data: data,
        layout: {
          xaxis: { title: { text: 'Round-trip phase δ/2π' }, range: [-0.5, 2], gridcolor: pal.grid, zeroline: false },
          yaxis: { title: { text: 'I<sub>t</sub> / I₀' }, range: [0, 1.05], gridcolor: pal.grid }
        }
      };
    }

    var plot = makePlot('plot-airy', build);

    function update() {
      var R = parseFloat(rIn.value);
      var theta = parseFloat(thIn.value) * Math.PI / 180;
      var d = parseFloat(dIn.value) * 1e-6;
      var n = parseFloat(nIn.value);
      var lam = parseFloat(lamIn.value) * 1e-9;
      rVal.textContent = R.toFixed(2);
      thVal.textContent = thIn.value + '°';

      var F = FP.finesseCoefficient(R);
      var fin = FP.finesse(R);
      var nuF = FP.fsrHz(d, n);
      var dlF = FP.deltaLambdaFSR(lam, d, n);
      var m = FP.orderNumber(d, n, theta, lam);
      var resPow = FP.resolvingPower(d, n, lam, R);
      var peakW = nuF / fin;

      if (plot) plot.render();

      if (readout) {
        readout.innerHTML =
          '<span>F = 4R/(1−R)² = <b>' + fmt(F, 4) + '</b></span>' +
          '<span>𝓕 = π√R/(1−R) = <b>' + fmt(fin, 4) + '</b></span>' +
          '<span>Δν<sub>FSR</sub> = c/2nd = <b>' + fmtHz(nuF) + '</b></span>' +
          '<span>Δλ<sub>FSR</sub> ≈ λ²/2nd = <b>' + fmt(dlF * 1e9, 3) + ' nm</b> at λ = ' + (lam * 1e9) + ' nm</span>' +
          '<span>Peak width δν<sub>½</sub> = FSR/𝓕 ≈ <b>' + fmtHz(peakW) + '</b></span>' +
          '<span>Order m = 2nd·cosθ/λ = <b>' + fmt(m, 4) + '</b></span>' +
          '<span>Resolving power λ/δλ<sub>min</sub> ≈ m𝓕 = <b>' + fmt(resPow, 4) + '</b></span>' +
          '<span>Min. transmission (lossless) = [(1−R)/(1+R)]² = <b>' + fmt(FP.minTransmission(R), 3) + '</b></span>';
      }

      if (formula) {
        var mInt = Math.max(1, Math.round(m));
        var lamRes = 2 * n * d * Math.cos(theta) / mInt;
        Equations.render(formula,
          '\\dfrac{I_t}{I_0}=\\dfrac{1}{1+\\left(' + fmt(F, 3) + '\\right)\\sin^2(\\delta/2)},\\qquad \\mathcal{F}=' + fmt(fin, 3) +
          ',\\qquad \\lambda_{m=' + mInt + '} = \\dfrac{2nd\\cos\\theta}{m} = ' + fmt(lamRes * 1e9, 4) + '\\ \\mathrm{nm}',
          true);
      }
    }

    [rIn, thIn, dIn, nIn, lamIn].forEach(function (el) {
      el && el.addEventListener('input', update);
    });
    update();
  }

  function initThreshold() {
    var el = $('thr-out');
    if (!el) return;
    var R1 = $('thr-R1'), R2 = $('thr-R2'), al = $('thr-alpha'), L = $('thr-L'), n = $('thr-n');
    var r1v = $('thr-R1-val'), r2v = $('thr-R2-val');

    function update() {
      var r1 = parseFloat(R1.value), r2 = parseFloat(R2.value);
      var a = parseFloat(al.value) * 100;
      var len = parseFloat(L.value) * 1e-2;
      var idx = parseFloat(n.value);
      r1v.textContent = r1.toFixed(4);
      r2v.textContent = r2.toFixed(4);
      var gth = FP.thresholdGain(len, r1, r2, a);
      var Lrt = FP.roundTripLoss(len, r1, r2, a);
      var tau = FP.photonLifetime(len, idx, r1, r2, a);
      var dnu = FP.cavityLinewidth(tau);
      var nuF = FP.fsrCavityHz(len, idx);
      var Rbar = Math.sqrt(r1 * r2);
      var fin = FP.finesse(Rbar);
      el.innerHTML =
        '<span>L<sub>rt</sub> = 2α_sL + ln(1/R₁R₂) = <b>' + fmt(Lrt, 3) + '</b></span>' +
        '<span>g<sub>th</sub> = <b>' + fmt(gth, 4) + ' m⁻¹ = ' + fmt(gth / 100, 3) + ' cm⁻¹</b></span>' +
        '<span>Mirror loss (1/2L)·ln(1/R₁R₂) = <b>' + fmt((1 / (2 * len)) * Math.log(1 / (r1 * r2)) / 100, 3) + ' cm⁻¹</b></span>' +
        '<span>Photon lifetime τ_c = <b>' + fmt(tau * 1e9, 4) + ' ns</b></span>' +
        '<span>Cold-cavity linewidth δν_c = <b>' + fmtHz(dnu) + '</b></span>' +
        '<span>FSR = c/2nL = <b>' + fmtHz(nuF) + '</b></span>' +
        '<span>FSR/𝓕 (R̄=√(R₁R₂)= ' + Rbar.toFixed(3) + ') ≈ <b>' + fmtHz(nuF / fin) + '</b></span>' +
        '<span>Round-trip time = <b>' + fmt(2 * idx * len / C * 1e9, 4) + ' ns</b></span>';
    }
    [R1, R2, al, L, n].forEach(function (x) { x && x.addEventListener('input', update); });
    update();
  }

  function initGain() {
    var Lin = $('gain-L'), dgIn = $('gain-dnu'), thrIn = $('gain-thr');
    var lVal = $('gain-L-val'), dgVal = $('gain-dnu-val'), tVal = $('gain-thr-val');
    var out = $('gain-out');

    function build(pal) {
      var L = parseFloat(Lin.value) * 1e-2;
      var dg = parseFloat(dgIn.value) * 1e9;
      var thr = parseFloat(thrIn.value);
      lVal.textContent = Lin.value + ' cm';
      dgVal.textContent = dgIn.value + ' GHz';
      tVal.textContent = thr.toFixed(2);
      var nuF = FP.fsrCavityHz(L, 1);
      var sigma = dg / (2 * Math.sqrt(2 * Math.log(2)));
      var xmax = Math.max(3, Math.ceil(2.5 * sigma / nuF));
      var xs = [];
      for (var i = 0; i <= 400; i++) xs.push(-xmax + 2 * xmax * i / 400);
      var gainTrace = {
        x: xs, y: xs.map(function (x) { return FP.gainProfile(x * nuF, dg); }),
        mode: 'lines', line: { color: pal.soft, width: 1.6 }, name: 'gain curve', showlegend: true, hoverinfo: 'skip'
      };
      var stemX = [], stemY = [], markX = [], markY = [], colArr = [], belowX = [], belowY = [];
      var count = 0;
      for (var mi = -8; mi <= 8; mi++) {
        var g = FP.gainProfile(mi * nuF, dg);
        if (Math.abs(mi * nuF) > Math.max(nuF, 2.5 * dg)) continue;
        stemX.push(mi, mi, null);
        stemY.push(0, g, null);
        if (g > thr) { markX.push(mi); markY.push(g); colArr.push(pal.accent); count++; }
        else { belowX.push(mi); belowY.push(g); }
      }
      if (out) {
        var note = count === 1 ? ' (single-frequency operation)' : '';
        out.innerHTML =
          '<span>Δν<sub>FSR</sub> = c/2L = <b>' + fmtHz(nuF) + '</b></span>' +
          '<span>Modes above threshold: <b>' + count + '</b>' + note + '</span>' +
          '<span>Δν<sub>g</sub>/Δν<sub>FSR</sub> ≈ <b>' + fmt(dg / nuF, 3) + '</b></span>' +
          '<span>N<sub>q</sub> ≈ Δν<sub>g,above</sub>/FSR — shorten L to raise spacing</span>';
      }
      return {
        data: [
          gainTrace,
          { x: [-xmax, xmax], y: [thr, thr], mode: 'lines', line: { color: pal.warn, width: 1.2, dash: 'dash' }, name: 'threshold', showlegend: true, hoverinfo: 'skip' },
          { x: stemX, y: stemY, mode: 'lines', line: { color: pal.grid, width: 1 }, showlegend: false, hoverinfo: 'skip' },
          { x: belowX, y: belowY, mode: 'markers', marker: { color: pal.soft, size: 7, symbol: 'circle-open' }, name: 'below threshold', showlegend: true },
          { x: markX, y: markY, mode: 'markers', marker: { color: colArr, size: 9, symbol: 'circle' }, name: 'oscillating modes', showlegend: true }
        ],
        layout: {
          showlegend: true,
          legend: { orientation: 'h', y: 1.12, font: { size: 11 } },
          xaxis: { title: { text: '(ν − ν₀)/Δν<sub>FSR</sub>' }, range: [-xmax, xmax], gridcolor: pal.grid, zeroline: true },
          yaxis: { title: { text: 'Gain (norm.)' }, range: [0, 1.15], gridcolor: pal.grid }
        }
      };
    }

    var gainPlot = makePlot('plot-gain', build);
    [Lin, dgIn, thrIn].forEach(function (x) { x && x.addEventListener('input', gainPlot.render); });
  }

  function initHG() {
    var lSel = $('hg-l'), mSel = $('hg-m'), wIn = $('hg-w'), wVal = $('hg-w-val'), nodesChk = $('hg-nodes');
    var note = $('hg-note');
    var N = 240;
    var off = document.createElement('canvas');
    off.width = N; off.height = N;
    var offCtx = null;
    try { offCtx = off.getContext('2d'); } catch (e) { offCtx = null; }
    if (!offCtx) {
      if (note) note.textContent = 'Canvas 2D unavailable in this browser.';
      return;
    }
    var img = offCtx.createImageData(N, N);

    function draw(c2d, w, hh, cols) {
      var l = parseInt(lSel.value, 10);
      var m = parseInt(mSel.value, 10);
      var wRel = parseFloat(wIn.value);
      wVal.textContent = wRel.toFixed(2);
      var s2 = Math.SQRT2;
      var half = 2.6;

      var maxI = 0;
      var vals = new Float32Array(N * N);
      for (var iy = 0; iy < N; iy++) {
        var yn = s2 * (2 * half * (iy / (N - 1)) - half) / wRel;
        for (var ix = 0; ix < N; ix++) {
          var xn = s2 * (2 * half * (ix / (N - 1)) - half) / wRel;
          var v = FP.hgProfileUV(l, m, xn, yn);
          var inten = v * v;
          vals[iy * N + ix] = inten;
          if (inten > maxI) maxI = inten;
        }
      }
      var d = img.data;
      for (var pI = 0; pI < N * N; pI++) {
        var vNorm = maxI > 0 ? Math.sqrt(vals[pI] / maxI) : 0;
        var gval = Math.round(vNorm * 255);
        var j = pI * 4;
        if (cols.dark) {
          d[j] = gval; d[j + 1] = gval; d[j + 2] = gval;
        } else {
          var inv = 255 - gval;
          d[j] = inv; d[j + 1] = inv; d[j + 2] = inv;
        }
        d[j + 3] = 255;
      }
      offCtx.putImageData(img, 0, 0);
      c2d.imageSmoothingEnabled = true;
      c2d.drawImage(off, 0, 0, w, hh);

      if (nodesChk.checked) {
        c2d.strokeStyle = hexToRgba(cols.accent, cols.dark ? 0.8 : 0.55);
        c2d.setLineDash([4, 4]);
        var sx = w / (2 * half);
        var sy = hh / (2 * half);
        if (l > 0) {
          FP.hgRoots(l).forEach(function (xi) {
            var xp = w / 2 + (xi * wRel / Math.SQRT2) * sx;
            if (xp < 0 || xp > w) return;
            c2d.beginPath(); c2d.moveTo(xp, 0); c2d.lineTo(xp, hh); c2d.stroke();
          });
        }
        if (m > 0) {
          FP.hgRoots(m).forEach(function (yi) {
            var yp = hh / 2 - (yi * wRel / Math.SQRT2) * sy;
            if (yp < 0 || yp > hh) return;
            c2d.beginPath(); c2d.moveTo(0, yp); c2d.lineTo(w, yp); c2d.stroke();
          });
        }
        c2d.setLineDash([]);
      }

      c2d.fillStyle = cols.fg;
      c2d.font = '12px system-ui';
      c2d.fillText('TEM_' + l + m + '', 10, 18);
      if (note) {
        var extents = Math.sqrt(l + m + 1);
        note.innerHTML = '<b>Nodal lines:</b> ' + l + ' along x, ' + m + ' along y · lobe extent ≈ √(l+m+1)·w = ' +
          fmt(extents, 3) + '·w · degenerate ' + (l + m + 1) + ' modes share each frequency (same N = ' + (l + m) + ')';
      }
    }

    var view = makeCanvas('canvas-hg', draw);
    if (!view) return;
    [lSel, mSel, wIn, nodesChk].forEach(function (el) {
      el && el.addEventListener('input', view.redraw);
      el && el.addEventListener('change', view.redraw);
    });
  }

  var fitterState = { g1: 1, g2: 0.4 };

  function fitterCompute() {
    var Lcm = parseFloat($('fitter-L').value);
    var lam = parseFloat($('fitter-lambda').value) * 1e-9;
    var L = Lcm * 1e-2;
    var p1 = $('fitter-plane1').checked;
    var p2 = $('fitter-plane2').checked;
    var Rc1 = p1 ? Infinity : parseFloat($('fitter-Rc1').value) * L;
    var Rc2 = p2 ? Infinity : parseFloat($('fitter-Rc2').value) * L;
    var g1 = FP.gParam(L, Rc1);
    var g2 = FP.gParam(L, Rc2);
    var mat = FP.cavityMatching(L, Rc1, Rc2);
    return { L: L, Lcm: Lcm, lam: lam, p1: p1, p2: p2, Rc1: Rc1, Rc2: Rc2, g1: g1, g2: g2, mat: mat };
  }

  function drawStab(c2d, w, hh, cols) {
    var R = 2.4;
    var cx = w / 2, cy = hh / 2;
    var px = Math.min(w, hh) / (2 * R) * 0.96;

    function TX(g1, g2) {
      return { x: cx + g1 * px, y: cy - g2 * px };
    }

    c2d.fillStyle = cols.accent;
    c2d.globalAlpha = 0.14;
    c2d.beginPath();
    c2d.moveTo(TX(0, 0).x, TX(0, 0).y);
    c2d.lineTo(TX(R, 0).x, TX(R, 0).y);
    for (var gx = R; gx >= 1 / R; gx -= R / 200) {
      var pt = TX(gx, 1 / gx);
      c2d.lineTo(pt.x, pt.y);
    }
    c2d.lineTo(TX(0, R).x, TX(0, R).y);
    c2d.closePath();
    c2d.fill();

    c2d.beginPath();
    c2d.moveTo(TX(0, 0).x, TX(0, 0).y);
    c2d.lineTo(TX(-R, 0).x, TX(-R, 0).y);
    for (var gx2 = -R; gx2 <= -1 / R; gx2 += R / 200) {
      var pt2 = TX(gx2, 1 / gx2);
      c2d.lineTo(pt2.x, pt2.y);
    }
    c2d.lineTo(TX(0, -R).x, TX(0, -R).y);
    c2d.closePath();
    c2d.fill();
    c2d.globalAlpha = 1;

    c2d.strokeStyle = cols.accent;
    c2d.lineWidth = 1.6;
    c2d.beginPath();
    for (var hx = 1 / R; hx <= R; hx += R / 200) {
      var hp = TX(hx, 1 / hx);
      if (hx === 1 / R) c2d.moveTo(hp.x, hp.y); else c2d.lineTo(hp.x, hp.y);
    }
    for (var hx2 = -R; hx2 <= -1 / R; hx2 += R / 200) {
      var hp2 = TX(hx2, 1 / hx2);
      if (hx2 === -R) c2d.moveTo(hp2.x, hp2.y); else c2d.lineTo(hp2.x, hp2.y);
    }
    c2d.stroke();
    c2d.lineWidth = 1;

    c2d.strokeStyle = cols.soft;
    c2d.beginPath();
    c2d.moveTo(0, cy); c2d.lineTo(w, cy);
    c2d.moveTo(cx, 0); c2d.lineTo(cx, hh);
    c2d.stroke();

    for (var gl = -2; gl <= 2; gl++) {
      if (gl === 0) continue;
      var tx = TX(gl, 0), ty = TX(0, gl);
      c2d.globalAlpha = 0.5;
      c2d.beginPath(); c2d.moveTo(tx.x, cy - 3); c2d.lineTo(tx.x, cy + 3); c2d.stroke();
      c2d.beginPath(); c2d.moveTo(cx - 3, ty.y); c2d.lineTo(cx + 3, ty.y); c2d.stroke();
      c2d.globalAlpha = 1;
    }
    c2d.fillStyle = cols.soft;
    c2d.font = '11px system-ui';
    c2d.fillText('g₁', w - 20, cy - 6);
    c2d.fillText('g₂', cx + 6, 14);
    c2d.fillText('stable', TX(0.55, 0.35).x, TX(0.55, 0.35).y);
    c2d.fillText('stable', TX(-0.55, -0.35).x, TX(-0.55, -0.35).y);
    c2d.fillText('unstable', TX(1.35, -1.2).x, TX(1.35, -1.2).y);
    c2d.fillText('unstable', TX(-1.75, 1.35).x, TX(-1.75, 1.35).y);
    c2d.fillText('g₁g₂ = 1', TX(1.55, 1 / 1.55).x - 4, TX(1.55, 1 / 1.55).y - 8);

    var specials = [
      { g1: 1, g2: 1, label: 'plane–plane' },
      { g1: 0, g2: 0, label: 'confocal' },
      { g1: -1, g2: -1, label: 'concentric' },
      { g1: 1, g2: 0, label: 'hemi.' },
      { g1: 0, g2: 1, label: '' }
    ];
    specials.forEach(function (sp) {
      var pt = TX(sp.g1, sp.g2);
      c2d.fillStyle = cols.fg;
      c2d.beginPath();
      c2d.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      c2d.fill();
      if (sp.label) {
        c2d.fillStyle = cols.soft;
        c2d.fillText(sp.label, pt.x + 5, pt.y - 5);
      }
    });

    var pp = TX(fitterState.g1, fitterState.g2);
    c2d.fillStyle = cols.warn;
    c2d.beginPath();
    c2d.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
    c2d.fill();
    c2d.strokeStyle = cols.fg;
    c2d.stroke();
  }

  function initFitter() {
    var stab = makeCanvas('canvas-stab', drawStab);
    var Ls = $('fitter-L'), lamIn = $('fitter-lambda');
    var p1 = $('fitter-plane1'), p2 = $('fitter-plane2');
    var Rc1 = $('fitter-Rc1'), Rc2 = $('fitter-Rc2');
    var Rv1 = $('fitter-Rc1-val'), Rv2 = $('fitter-Rc2-val');
    var out = $('fitter-out');

    var lastFit = null;

    function envBuild(pal) {
      if (!lastFit) return null;
      var L = lastFit.mat.z2 - lastFit.mat.z1;
      var z1 = lastFit.mat.z1, z2 = lastFit.mat.z2;
      var pad = 0.25 * L;
      var zmin = z1 - pad, zmax = z2 + pad;
      var zs = [];
      var N = 240;
      for (var i = 0; i <= N; i++) zs.push(zmin + (zmax - zmin) * i / N);
      var wUp = zs.map(function (z) { return FP.spotSize(lastFit.w0, lastFit.mat.zR, z); });
      var wDn = zs.map(function (z) { return -FP.spotSize(lastFit.w0, lastFit.mat.zR, z); });
      var ymax = 1.15 * Math.max.apply(null, wUp);
      var mirrorGs = 1.08 * ymax;
      return {
        data: [
          { x: zs, y: wUp, mode: 'lines', line: { color: pal.accent, width: 2 }, name: 'beam radius w(z)', hoverinfo: 'skip' },
          { x: zs, y: wDn, mode: 'lines', line: { color: pal.accent, width: 2 }, showlegend: false, hoverinfo: 'skip' },
          { x: [z1, z1, null, z2, z2], y: [mirrorGs, -mirrorGs, null, mirrorGs, -mirrorGs], mode: 'lines', line: { color: pal.soft, width: 1.4 }, showlegend: false, hoverinfo: 'skip' },
          { x: [0], y: [0], mode: 'markers', marker: { color: pal.warn, size: 7, symbol: 'diamond' }, name: 'waist' }
        ],
        layout: {
          xaxis: { title: { text: 'z (m), waist at z = 0' }, gridcolor: pal.grid, zeroline: false },
          yaxis: { title: { text: 'Beam radius w (m)' }, gridcolor: pal.grid, range: [-ymax, ymax] }
        }
      };
    }

    function envMessage(msg) {
      var el = $('plot-env');
      if (el) el.innerHTML = '<p class="hint">' + msg + '</p>';
    }

    var envPlot = makePlot('plot-env', envBuild);

    function sliderG(planeChk, slider, L, g) {
      if (Math.abs(1 - g) < 0.015) planeChk.checked = true;
      else {
        planeChk.checked = false;
        slider.value = Math.min(5, Math.max(0.55, 1 / (1 - g)));
      }
    }

    function syncSliders() {
      var L = parseFloat(Ls.value) * 1e-2;
      sliderG(p1, Rc1, L, fitterState.g1);
      sliderG(p2, Rc2, L, fitterState.g2);
    }

    function onInput() {
      Rc1.disabled = p1.checked;
      Rc2.disabled = p2.checked;
      updateFitter(true);
    }

    function updateFitter(recompute) {
      if (recompute !== false) {
        var st0 = fitterCompute();
        fitterState.g1 = st0.g1;
        fitterState.g2 = st0.g2;
      }
      if (stab) stab.redraw();

      Rv1.textContent = p1.checked ? '∞' : parseFloat(Rc1.value).toFixed(2) + ' L';
      Rv2.textContent = p2.checked ? '∞' : parseFloat(Rc2.value).toFixed(2) + ' L';

      var st2 = fitterCompute();
      var mat = st2.mat;
      var stabTxt, cls;
      var prod = st2.g1 * st2.g2;
      if (prod >= 0 && prod < 1) { stabTxt = 'stable'; cls = 'stable'; }
      else if (prod === 1) { stabTxt = 'marginal (g₁g₂ = 1)'; cls = 'warn'; }
      else if (prod === 0) { stabTxt = 'marginal'; cls = 'warn'; }
      else { stabTxt = 'unstable'; cls = 'warn'; }
      if (st2.g1 === 0 && st2.g2 === 0) stabTxt = 'marginal (confocal)';

      var html = '';
      html += '<span>g₁ = <b>' + (isFinite(st2.Rc1) ? fmt(st2.g1, 4) : '1 (plane)') + '</b></span>';
      html += '<span>g₂ = <b>' + (isFinite(st2.Rc2) ? fmt(st2.g2, 4) : '1 (plane)') + '</b></span>';
      html += '<span>g₁g₂ = <b>' + fmt(prod, 4) + '</b> — <b class="' + cls + '">' + stabTxt + '</b></span>';

      if (mat.stable && isFinite(mat.zR) && mat.zR > 1e-9) {
        var w0 = FP.waistFromZR(st2.lam, mat.zR);
        var w1 = FP.spotSize(w0, mat.zR, Math.abs(mat.z1));
        var w2 = FP.spotSize(w0, mat.zR, Math.abs(mat.z2));
        var div = FP.divergenceAngle(st2.lam, w0);
        var dz = FP.deltaZeta(st2.g1, st2.g2);
        var nuF = FP.fsrCavityHz(st2.L, 1);
        var dnuT = FP.transverseSpacing(nuF, dz);
        var waistFromM1 = Math.abs(mat.z1);
        html += '<span>z_R = <b>' + fmtLength(mat.zR) + '</b></span>';
        html += '<span>waist on axis at z₁ = <b>' + (waistFromM1 < 1e-9 ? 'on M₁' : fmtLength(waistFromM1) + ' from M₁') + '</b></span>';
        html += '<span>w₀ = √(λz_R/π) = <b>' + fmtLength(w0) + '</b></span>';
        html += '<span>w₁ on M₁ = <b>' + fmtLength(w1) + '</b></span>';
        html += '<span>w₂ on M₂ = <b>' + fmtLength(w2) + '</b></span>';
        html += '<span>θ<sub>div</sub> = λ/πw₀ = <b>' + fmtAngle(div) + '</b></span>';
        html += '<span>Δζ = <b>' + fmt(dz, 4) + ' rad (Δζ/π = ' + fmt(dz / Math.PI, 3) + ')</b></span>';
        html += '<span>Δν<sub>T</sub> per order N+1 = <b>' + fmt(dnuT / 1e6, 3) + ' MHz = ' + fmt(dnuT / nuF, 3) + '·FSR</b></span>';
        html += '<span>FSR = c/2L = <b>' + fmtHz(nuF) + '</b></span>';
        if (out) out.innerHTML = html;
        lastFit = { st: st2, mat: mat, w0: w0, z1: mat.z1, z2: mat.z2 };
        if (envPlot) envPlot.render();
      } else if (mat.stable) {
        html += '<span><b>Marginally stable boundary cavity</b> (g₁g₂ = 0 or 1, z_R = 0 or ∞) — mode size set by apertures/tilt, no robust Gaussian fit. Move inside the stable region.</span>';
        if (out) out.innerHTML = html;
        envMessage('Boundary cavity (z_R = 0 or ∞): beam size set by apertures, not mirrors. Adjust the sliders slightly inward for a Gaussian fit.');
      } else {
        html += '<span>No Gaussian solution: rays walk out of the cavity.</span>';
        if (out) out.innerHTML = html;
        envMessage('Unstable (g₁g₂ < 0 or > 1): no self-reproducing Gaussian beam. Unstable resonators need edge-coupled output and high gain.');
      }
    }

    [Ls, lamIn, p1, p2, Rc1, Rc2].forEach(function (el) {
      el && el.addEventListener('input', onInput);
      el && el.addEventListener('change', onInput);
    });

    var conf = $('fitter-confocal'), hene = $('fitter-hene');
    if (conf) conf.addEventListener('click', function () {
      Ls.value = 30; lamIn.value = 632.8;
      p1.checked = false; p2.checked = false;
      Rc1.value = 1.0; Rc2.value = 1.0;
      onInput();
    });
    if (hene) hene.addEventListener('click', function () {
      Ls.value = 30; lamIn.value = 632.8;
      p1.checked = true; p2.checked = false;
      Rc2.value = 1.667;
      onInput();
    });

    var dragging = false;
    var canvasEl = $('canvas-stab');
    canvasEl && canvasEl.addEventListener('pointerdown', function (e) {
      dragging = true;
      canvasEl.setPointerCapture(e.pointerId);
      track(e);
    });
    canvasEl && canvasEl.addEventListener('pointermove', function (e) {
      if (dragging) track(e);
    });
    canvasEl && canvasEl.addEventListener('pointerup', function () { dragging = false; });

    function track(e) {
      var rect = canvasEl.getBoundingClientRect();
      var Rg = 2.4;
      var px = Math.min(rect.width, rect.height) / (2 * Rg) * 0.96;
      var gx = (e.clientX - rect.left - rect.width / 2) / px;
      var gy = -(e.clientY - rect.top - rect.height / 2) / px;
      fitterState.g1 = Math.max(-2.39, Math.min(2.39, gx));
      fitterState.g2 = Math.max(-2.39, Math.min(2.39, gy));
      syncSliders();
      onInput();
    }

    onInput();
  }

  function initHene() {
    var out = $('hene-out');
    if (!out) return;
    var lamIn = $('hene-lambda'), LIn = $('hene-L'), rc2In = $('hene-Rc2'), dgIn = $('hene-dg');

    function update() {
      var lam = parseFloat(lamIn.value) * 1e-9;
      var L = parseFloat(LIn.value);
      var Rc2 = parseFloat(rc2In.value);
      var dg = parseFloat(dgIn.value) * 1e9;
      var mat = FP.cavityMatching(L, Infinity, Rc2);
      if (!mat.stable) {
        out.innerHTML = '<span><b>Unstable cavity:</b> need R<sub>c2</sub> &gt; L for plano-concave stability.</span>';
        return;
      }
      var w0 = FP.waistFromZR(lam, mat.zR);
      var w2 = FP.spotSize(w0, mat.zR, L);
      var div = FP.divergenceAngle(lam, w0);
      var nuF = FP.fsrCavityHz(L, 1);
      var comb = FP.modeComb(L, 1, dg, 0.5);
      var dz = FP.deltaZeta(1, FP.gParam(L, Rc2));
      var dnuT = FP.transverseSpacing(nuF, dz);
      out.innerHTML =
        '<span>g₁ = <b>1</b>, g₂ = <b>' + fmt(FP.gParam(L, Rc2), 3) + '</b>, g₁g₂ = <b>' + fmt(FP.gParam(L, Rc2), 3) + '</b> — stable</span>' +
        '<span>z_R = √(L(R<sub>c2</sub>−L)) = <b>' + fmtLength(mat.zR) + '</b></span>' +
        '<span>w₀ on flat mirror = <b>' + fmtLength(w0) + '</b></span>' +
        '<span>w₂ on output coupler = <b>' + fmtLength(w2) + '</b></span>' +
        '<span>θ<sub>div</sub> = λ/πw₀ = <b>' + fmtAngle(div) + '</b></span>' +
        '<span>FSR = c/2L = <b>' + fmtHz(nuF) + '</b></span>' +
        '<span>Longitudinal modes in gain (thr = 0.5): <b>' + comb.count + '</b> of Δν_g = ' + fmt(dg / 1e9, 3) + ' GHz</span>' +
        '<span>Δν<sub>T</sub> = (Δζ/π)·FSR = <b>' + fmt(dnuT / 1e6, 3) + ' MHz</b></span>';
    }
    [lamIn, LIn, rc2In, dgIn].forEach(function (x) { x && x.addEventListener('input', update); });
    update();
  }

  function initDiode() {
    var out = $('diode-out');
    if (!out) return;
    var nIn = $('diode-n'), ngIn = $('diode-ng'), LIn = $('diode-L'), lamIn = $('diode-lambda');

    function update() {
      var n = parseFloat(nIn.value), ng = parseFloat(ngIn.value);
      var L = parseFloat(LIn.value) * 1e-6;
      var lam = parseFloat(lamIn.value) * 1e-9;
      var R = FP.facetReflectivity(n);
      var mirrorLoss = Math.log(1 / R) / (L * 100);
      var nuF = FP.fsrCavityHz(L, ng);
      var dLam = lam * lam * nuF / C;
      out.innerHTML =
        '<span>Facet R = ((n−1)/(n+1))² = <b>' + fmt(R, 3) + '</b></span>' +
        '<span>Mirror loss ln(1/R)/L = <b>' + fmt(mirrorLoss, 4) + ' cm⁻¹</b></span>' +
        '<span>Round-trip time 2n<sub>g</sub>L/c = <b>' + fmt(2 * ng * L / C * 1e12, 4) + ' ps</b></span>' +
        '<span>Longitudinal spacing c/2n<sub>g</sub>L = <b>' + fmtHz(nuF) + '</b></span>' +
        '<span>At λ = ' + (lam * 1e9) + ' nm: Δλ = λ²·Δν/c = <b>' + fmt(dLam * 1e9, 3) + ' nm</b></span>';
    }
    [nIn, ngIn, LIn, lamIn].forEach(function (x) { x && x.addEventListener('input', update); });
    update();
  }

  function initConfocal() {
    var out = $('conf-out');
    if (!out) return;
    var LIn = $('conf-L');

    function update() {
      var L = parseFloat(LIn.value) * 1e-2;
      var f4 = FP.confocalFSR(L);
      var f2 = FP.fsrCavityHz(L, 1);
      out.innerHTML =
        '<span>Effective FSR (ray retraces after 2 round trips): c/4L = <b>' + fmtHz(f4) + '</b></span>' +
        '<span>Longitudinal spacing c/2L = <b>' + fmtHz(f2) + '</b></span>' +
        '<span>SEM gap Δζ/π = <b>0.5</b> → every transverse order shifts ν<sub>F</sub>/2 = <b>' + fmtHz(f2 / 2) + '</b></span>' +
        '<span>Uniform comb spacing = <b>' + fmtHz(f4) + '</b></span>';
    }
    LIn && LIn.addEventListener('input', update);
    update();
  }

  function initNav() {
    var links = document.querySelectorAll('.toc a');
    var map = {};
    Array.prototype.forEach.call(links, function (a) {
      map[a.getAttribute('href').slice(1)] = a;
    });
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            Array.prototype.forEach.call(links, function (a) { a.classList.remove('active'); });
            if (map[e.target.id]) map[e.target.id].classList.add('active');
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      document.querySelectorAll('section[id]').forEach(function (s) { obs.observe(s); });
    }
  }

  function initInPageTests() {
    var btn = $('tests-run'), out = $('tests-out');
    if (!btn || !out) return;
    btn.addEventListener('click', function () {
      out.hidden = false;
      var pass = 0, fail = 0;
      var lines = [];
      function ok(name, actual, expected, relTol) {
        relTol = relTol || 1e-3;
        var err = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300);
        if (err <= relTol) { pass++; lines.push('✓ ' + name); }
        else { fail++; lines.push('✗ ' + name + ': got ' + actual + ', want ' + expected); }
      }
      function of(name, cond) {
        if (cond) { pass++; lines.push('✓ ' + name); } else { fail++; lines.push('✗ ' + name); }
      }
      ok('finesse(0.9) ≈ 30', FP.finesse(0.9), 29.806, 1e-3);
      ok('FSR(1 mm, n=1.45) ≈ 103 GHz', FP.fsrHz(1e-3, 1.45), 103.377e9, 1e-3);
      ok('resolving power ≈ 1.37e5', FP.resolvingPower(1e-3, 1.45, 632.8e-9, 0.9), (2 * 1.45e-3 / 632.8e-9) * FP.finesse(0.9), 1e-9);
      ok('diode facet R ≈ 0.31', FP.facetReflectivity(3.5), 0.3086, 1e-3);
      ok('HeNe g₁g₂ = 0.4', FP.gParam(0.3, Infinity) * FP.gParam(0.3, 0.5), 0.4, 1e-9);
      ok('HeNe z_R = 0.245 m', FP.cavityMatching(0.3, Infinity, 0.5).zR, Math.sqrt(0.3 * 0.2), 1e-9);
      ok('HeNe w₀ ≈ 0.222 mm', FP.waistFromZR(632.8e-9, FP.cavityMatching(0.3, Infinity, 0.5).zR), 2.221e-4, 1e-2);
      ok('HeNe FSR = 500 MHz', FP.fsrCavityHz(0.3, 1), C / 0.6, 1e-9);
      ok('HeNe Δν_T ≈ 141 MHz', FP.transverseSpacing(C / 0.6, FP.deltaZeta(1, 0.4)), 141e6, 6e-3);
      ok('confocal z_R = L/2', FP.cavityMatching(0.5, 0.5, 0.5).zR, 0.25, 1e-9);
      ok('confocal FSR = c/4L', FP.confocalFSR(0.3), C / 1.2, 1e-9);
      ok('Δζ confocal = π/2', FP.deltaZeta(0, 0), Math.PI / 2, 1e-9);
      ok('Δζ HeNe = arccos√0.4', FP.deltaZeta(1, 0.4), Math.acos(Math.sqrt(0.4)), 1e-9);
      ok('threshold gain identity', FP.thresholdGain(0.3, 0.98, 0.95, 1e-3), 1e-3 + Math.log(1 / 0.98 / 0.95) / 0.6, 1e-9);
      ok('airy peak = 1', FP.airy(0.9, 4 * Math.PI), 1, 1e-12);
      ok('airy min = ((1−R)/(1+R))²', FP.airy(0.9, Math.PI), FP.minTransmission(0.9), 1e-12);
      ok('H2(2) = 14', FP.hermite(2, 2), 14, 1e-12);
      ok('mode comb: 3 modes (HeNe)', FP.modeComb(0.3, 1, 1.5e9, 0.5).count, 3, 1e-9);
      of('unstable cavity → NaN', Number.isNaN(FP.cavityMatching(0.3, 0.25, 10).zR));
      lines.push((pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
      out.textContent = lines.join('\n');
    });
  }

  function init() {
    Theme.init('theme-toggle');
    try {
      Equations.renderAll();
    } catch (e) {
      console.error('[widgets] equation rendering failed:', e);
    }

    var inits = [
      { name: 'rays animation', fn: initRays, anchor: 'canvas-rays' },
      { name: 'Airy transmission', fn: initAiry, anchor: 'plot-airy' },
      { name: 'threshold calculator', fn: initThreshold, anchor: 'thr-out' },
      { name: 'gain mode comb', fn: initGain, anchor: 'plot-gain' },
      { name: 'TEM mode patterns', fn: initHG, anchor: 'canvas-hg' },
      { name: 'stability fitter', fn: initFitter, anchor: 'fitter-out' },
      { name: 'He-Ne calculator', fn: initHene, anchor: 'hene-out' },
      { name: 'diode calculator', fn: initDiode, anchor: 'diode-out' },
      { name: 'confocal calculator', fn: initConfocal, anchor: 'conf-out' },
      { name: 'section navigation', fn: initNav },
      { name: 'in-page tests', fn: initInPageTests, anchor: 'tests-out' }
    ];

    inits.forEach(function (w) {
      try {
        w.fn();
      } catch (e) {
        console.error('[widgets] ' + w.name + ' failed to initialize:', e);
        var anchor = w.anchor && $(w.anchor);
        if (anchor) {
          var note = anchor.ownerDocument.createElement('p');
          note.className = 'widget-error';
          note.textContent = 'Widget "' + w.name + '" failed to start: ' + e.message;
          (anchor.closest('.widget') || anchor.parentNode).insertBefore(note, anchor);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
