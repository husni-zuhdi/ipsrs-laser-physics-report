'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const site = __dirname;
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');

let passed = 0, failed = 0;

function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error(`FAIL ${name}`); }
}

const vc = new VirtualConsole();
const pageLogs = [];
vc.on('jsdomError', () => { });
vc.on('log', (...a) => pageLogs.push(a.join(' ')));
vc.on('warn', (...a) => pageLogs.push('[warn] ' + a.join(' ')));
vc.on('error', (...a) => pageLogs.push('[error] ' + a.join(' ')));

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const w = dom.window;

const plotReactCalls = [];
w.Plotly = {
  react: (el, data, layout, config) => {
    if (typeof el === 'string') el = w.document.getElementById(el);
    check(`Plotly.react trace arrays valid (${el.id || 'plot'})`, Array.isArray(data) && data.length > 0 &&
      data.every(t => Array.isArray(t.x) || Array.isArray(t.y)));
    plotReactCalls.push(el.id);
  },
  newPlot: (el) => {
    if (typeof el === 'string') el = w.document.getElementById(el);
    plotReactCalls.push(el.id);
  },
  relayout: () => { }
};

w.eval(fs.readFileSync(path.join(site, 'js/physics.js'), 'utf8'));
w.eval(fs.readFileSync(path.join(site, 'js/equations.js'), 'utf8'));
w.eval(`window.Equations.setAdapter({ name: 'stub', render: function (el, tex, dm) {
  el.innerHTML = '<math data-stub="1"></math>';
} });`);
w.eval(fs.readFileSync(path.join(site, 'js/theme.js'), 'utf8'));
w.eval(fs.readFileSync(path.join(site, 'js/widgets.js'), 'utf8'));

setTimeout(() => {
  const $ = id => w.document.getElementById(id);
  const before = plotReactCalls.length;

  const eqDivs = w.document.querySelectorAll('.eq[data-eq]');
  let withMath = 0;
  eqDivs.forEach(el => { if (el.querySelector('math')) withMath++; });
  check(`all ${eqDivs.length} equations render via module`, withMath === eqDivs.length);
  check('equations numbered', w.document.querySelectorAll('.eq .eqno').length === eqDivs.length);

  check('rays readout live', $('#rays-opd').textContent.includes('OPD'));
  check('airy readout live', $('#airy-readout').textContent.includes('𝓕'));
  check('threshold readout live', $('#thr-out').textContent.includes('g'));
  check('gain readout live', $('#gain-out').textContent.includes('FSR'));
  check('hg note live', $('#hg-note').textContent.includes('Nodal lines'));
  check('fitter readout live', $('#fitter-out').textContent.includes('g₁'));
  check('hene readout live', $('#hene-out').textContent.includes('z_R'));
  check('diode readout live', $('#diode-out').textContent.includes('Facet R'));
  check('confocal readout live', $('#conf-out').textContent.includes('Effective FSR'));
  check('no visible widget-failure notes', w.document.querySelectorAll('.widget-error').length === 0);

  $('#airy-R').value = '0.9';
  $('#airy-R').dispatchEvent(new w.Event('input', { bubbles: true }));
  check('airy R slider updates readout', $('#airy-readout').textContent.includes('29.80'));

  $('#hene-L').value = '0.30';
  $('#hene-L').dispatchEvent(new w.Event('input', { bubbles: true }));
  check('He-Ne calculator updates', $('#hene-out').textContent.includes('0.40'));

  $('#diode-L').value = '300';
  $('#diode-L').dispatchEvent(new w.Event('input', { bubbles: true }));
  check('diode calculator updates', $('#diode-out').textContent.includes('0.309'));

  $('#fitter-hene').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('fitter HeNe snap', $('#fitter-out').textContent.includes('0.4'));
  check('fitter env plot renders', plotReactCalls.filter(c => c === 'plot-env').length >= 1);

  $('#gain-dnu').value = '3';
  $('#gain-dnu').dispatchEvent(new w.Event('input', { bubbles: true }));
  check('gain react on input', plotReactCalls.length > before);

  $('#tests-run').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const tOut = $('#tests-out').textContent;
  check('in-page tests button works', /0 failed/.test(tOut));

  check('no page-thrown errors', pageLogs.filter(l => l.startsWith('[error]')).length === 0);

  console.log(`\ntests-ui: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}, 400);
