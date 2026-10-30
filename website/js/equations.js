(function (global) {
  'use strict';

  var registry = {};
  var adapter = null;

  function define(key, tex) {
    registry[key] = tex;
  }

  function defineAll(defs) {
    for (var key in defs) {
      if (Object.prototype.hasOwnProperty.call(defs, key)) {
        registry[key] = defs[key];
      }
    }
  }

  function get(key) {
    return registry[key];
  }

  function keys() {
    return Object.keys(registry);
  }

  function discoverAdapter() {
    var T = global.Temml || global.temml || null;
    if (T && T.render) {
      return {
        name: 'temml',
        render: function (el, tex, displayMode) {
          T.render(tex, el, { displayMode: !!displayMode, throwOnError: false });
        }
      };
    }
    return { name: 'none', render: null };
  }

  function setAdapter(next) {
    adapter = next ? next : discoverAdapter();
  }

  function fallback(el, tex, key, reason, err) {
    if (el) {
      el.textContent = '';
      var code = el.ownerDocument.createElement('code');
      code.className = 'tex-fallback';
      code.textContent = tex;
      el.appendChild(code);
    }
    console.warn('[equations] render failed for "' + key + '" (' + reason + '):',
      reason === 'library-unavailable' ? tex.slice(0, 60) + '…' : tex,
      err && err.message ? err.message : err);
    return { ok: false, reason: reason };
  }

  function render(el, tex, displayMode, key) {
    if (!el) return { ok: false, reason: 'no-element' };
    if (!adapter) setAdapter(discoverAdapter());
    if (!adapter.render) return fallback(el, tex, key || 'inline', 'library-unavailable', null);
    try {
      el.textContent = '';
      adapter.render(el, tex, !!displayMode);
      if (el.querySelector && el.querySelector('.temml-error')) {
        return fallback(el, tex, key || 'inline', 'parse-error', null);
      }
      return { ok: true };
    } catch (e) {
      return fallback(el, tex, key || 'inline', 'render-error', e);
    }
  }

  function renderAll(doc) {
    var d = doc || global.document || (typeof document !== 'undefined' ? document : null);
    if (!d) return { count: 0, failures: [] };
    var nodes = d.querySelectorAll('.eq[data-eq]');
    var failures = [];
    var num = 0;
    Array.prototype.forEach.call(nodes, function (el) {
      var key = el.getAttribute('data-eq');
      num++;
      var tex = registry[key];
      if (!tex) {
        var miss = fallback(el, '\u2018' + key + '\u2019 is not a registered equation', key, 'missing-key', null);
        if (!miss.ok) failures.push({ key: key, reason: 'missing-key' });
      } else {
        var res = render(el, tex, true, key);
        if (!res.ok) failures.push({ key: key, reason: res.reason });
      }
      var no = d.createElement('span');
      no.className = 'eqno';
      no.textContent = '(' + num + ')';
      el.appendChild(no);
    });
    return { count: num, failures: failures };
  }

  defineAll(registryData());

  function registryData() {
    return {
    opl: "\\Delta\\mathrm{OPL}=n\\left(\\frac{2d}{\\cos\\theta}-2d\\tan\\theta\\,\\sin\\theta\\right)=2nd\\cos\\theta",
    delta: "\\delta=\\frac{2\\pi}{\\lambda}\\,\\Delta\\mathrm{OPL}+\\varphi=\\frac{4\\pi nd\\cos\\theta}{\\lambda}+\\varphi",
    stokes: "r'=-r,\\qquad tt'=1-r^2",
    rt: "R=\\frac{P_r}{P_i}=r^2,\\qquad T=\\frac{P_t}{P_i}=\\frac{n_2\\cos\\theta_t}{n_1\\cos\\theta_i}\\,t^2",
    series: "E_t=E_0\\,tt'\\sum_{k=0}^{\\infty}\\left(R\\,e^{\\mathrm{i}\\delta}\\right)^k=\\frac{E_0\\,tt'}{1-R\\,e^{\\mathrm{i}\\delta}}",
    denom: "\\left|1-Re^{\\mathrm{i}\\delta}\\right|^2=(1-R)^2+4R\\sin^2\\!\\left(\\frac{\\delta}{2}\\right)",
    airy: "\\frac{I_t}{I_0}=\\frac{T^2}{(1-R)^2}\\,\\frac{1}{1+F\\sin^2(\\delta/2)},\\qquad F=\\frac{4R}{(1-R)^2}",
    resonance: "2nd\\cos\\theta=m\\lambda",
    fsr: "\\Delta\\nu_{\\mathrm{FSR}}=\\frac{c}{2nd},\\qquad\\Delta\\lambda_{\\mathrm{FSR}}\\simeq\\frac{\\lambda^2}{2nd}",
    finesse: "\\mathcal{F}=\\frac{\\Delta\\nu_{\\mathrm{FSR}}}{\\delta\\nu_{1/2}}=\\frac{\\pi\\sqrt{F}}{2}=\\frac{\\pi\\sqrt{R}}{1-R}",
    respower: "\\frac{\\lambda}{\\delta\\lambda_{\\min}}\\approx m\\,\\mathcal{F}=\\frac{2nd}{\\lambda}\\,\\frac{\\pi\\sqrt{R}}{1-R}",
    thr: "R_1R_2\\,e^{2(g-\\alpha_s)L}=1\\;\\Longrightarrow\\; g_{\\mathrm{th}}=\\alpha_s+\\frac{1}{2L}\\ln\\frac{1}{R_1R_2}",
    tauc: "\\tau_c=\\frac{2nL/c}{\\mathcal{L}_{\\mathrm{rt}}},\\qquad\\mathcal{L}_{\\mathrm{rt}}\\simeq2\\alpha_sL+\\ln\\frac{1}{R_1R_2},\\qquad\\delta\\nu_c=\\frac{1}{2\\pi\\tau_c}",
    longmodes: "\\nu_q=q\\,\\frac{c}{2nL},\\qquad\\Delta\\nu_q=\\nu_{q+1}-\\nu_q=\\frac{c}{2nL}=\\Delta\\nu_{\\mathrm{FSR}}",
    helmholtz: "\\nabla^2U+k^2U=0,\\qquad k=\\frac{n\\omega}{c}=\\frac{2\\pi}{\\lambda}",
    paraxial: "\\frac{\\partial^2u}{\\partial x^2}+\\frac{\\partial^2u}{\\partial y^2}-2\\mathrm{i}k\\,\\frac{\\partial u}{\\partial z}=0",
    ansatz: "u(x,y,z)=\\psi(z)\\exp\\!\\left[-\\mathrm{i}\\,\\frac{k}{2q(z)}\\left(x^2+y^2\\right)\\right]",
    qeq: "\\frac{dq}{dz}=1,\\qquad\\frac{1}{\\psi}\\frac{d\\psi}{dz}=-\\frac{1}{q(z)}",
    qz: "q(z)=z+\\mathrm{i}z_R,\\qquad\\frac{1}{q}=\\frac{z}{z^2+z_R^2}-\\mathrm{i}\\,\\frac{z_R}{z^2+z_R^2}",
    wz: "z_R=\\frac{\\pi w_0^2}{\\lambda},\\qquad w(z)=w_0\\sqrt{1+\\left(\\frac{z}{z_R}\\right)^2},\\qquad R(z)=z\\left[1+\\left(\\frac{z_R}{z}\\right)^2\\right]",
    psi: "\\psi(z)=A_0\\,\\frac{w_0}{w(z)}\\,e^{\\mathrm{i}\\zeta(z)},\\qquad\\zeta(z)=\\arctan\\frac{z}{z_R}",
    u00: "U_{00}=A_0\\,\\frac{w_0}{w}\\;e^{-\\frac{x^2+y^2}{w^2}}\\;e^{-\\mathrm{i}\\left[kz+\\frac{k(x^2+y^2)}{2R(z)}-\\zeta(z)\\right]}",
    herm: "H_0=1,\\qquad H_1(\\xi)=2\\xi,\\qquad H_2(\\xi)=4\\xi^2-2,\\qquad H_3(\\xi)=8\\xi^3-12\\xi,\\ \\dots",
    hg: "U_{lm}=A_{lm}\\,\\frac{w_0}{w}\\,H_l\\!\\left(\\frac{\\sqrt{2}\\,x}{w}\\right)H_m\\!\\left(\\frac{\\sqrt{2}\\,y}{w}\\right)e^{-\\frac{x^2+y^2}{w^2}}e^{-\\mathrm{i}\\left[kz+\\frac{k(x^2+y^2)}{2R}-(l+m+1)\\zeta\\right]}",
    match: "\\begin{gathered}z_R^2=\\frac{L\\,(R_{c1}-L)(R_{c2}-L)(R_{c1}+R_{c2}-L)}{(R_{c1}+R_{c2}-2L)^2},\\qquad z_1=-\\frac{L\\,(R_{c2}-L)}{R_{c1}+R_{c2}-2L},\\qquad z_2=\\frac{L\\,(R_{c1}-L)}{R_{c1}+R_{c2}-2L}\\\\R(z_1)=-R_{c1},\\qquad R(z_2)=+R_{c2},\\qquad z_2-z_1=L\\end{gathered}",
    transfreq: "\\nu_q=q\\,\\frac{c}{2nL}+\\frac{\\Delta\\zeta}{\\pi}\\,(l+m+1)\\,\\frac{c}{2nL}",
    dzeta: "\\Delta\\zeta=\\arccos\\!\\left(\\pm\\sqrt{g_1g_2}\\right)",
    raymatrix: "M=\\begin{pmatrix}1&0\\\\-2/R_{c2}&1\\end{pmatrix}\\begin{pmatrix}1&L\\\\0&1\\end{pmatrix}\\begin{pmatrix}1&0\\\\-2/R_{c1}&1\\end{pmatrix}\\begin{pmatrix}1&L\\\\0&1\\end{pmatrix}",
    gparam: "g_1=1-\\frac{L}{R_{c1}},\\qquad g_2=1-\\frac{L}{R_{c2}}",
    stabcond: "0\\le g_1g_2\\le 1",
    spots: "w_0^2=\\frac{\\lambda L}{\\pi}\\,\\frac{\\sqrt{g_1g_2(1-g_1g_2)}}{\\left|g_1+g_2-2g_1g_2\\right|},\\qquad w_1^2=\\frac{\\lambda L}{\\pi}\\sqrt{\\frac{g_2}{g_1(1-g_1g_2)}},\\qquad w_2^2=\\frac{\\lambda L}{\\pi}\\sqrt{\\frac{g_1}{g_2(1-g_1g_2)}}",
    symm: "w_0^2=\\frac{\\lambda L}{2\\pi}\\sqrt{\\frac{1+g}{1-g}},\\qquad w_1^2=w_2^2=\\frac{\\lambda L}{\\pi}\\,\\frac{1}{\\sqrt{1-g^2}}",
  };
  }

  var api = {
    define: define,
    defineAll: defineAll,
    get: get,
    keys: keys,
    render: render,
    renderAll: renderAll,
    setAdapter: setAdapter
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.Equations = api;

})(typeof window !== 'undefined' ? window : this);
