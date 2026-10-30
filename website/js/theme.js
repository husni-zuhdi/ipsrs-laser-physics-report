(function (global) {
  'use strict';

  var subscribers = [];

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function palette() {
    var cs = getComputedStyle(document.documentElement);
    function v(name, fallback) {
      var val = cs.getPropertyValue(name).trim();
      return val || fallback;
    }
    return {
      fg: v('--fg', '#1c2024'),
      soft: v('--fg-soft', '#5a626b'),
      grid: v('--grid', '#e3e6ea'),
      accent: v('--accent', '#1a4d8f'),
      warn: v('--warn', '#a33b3b'),
      canvasBg: v('--canvas-bg', '#ffffff'),
      dark: current() === 'dark'
    };
  }

  function subscribe(fn) {
    subscribers.push(fn);
    return function () {
      var i = subscribers.indexOf(fn);
      if (i > -1) subscribers.splice(i, 1);
    };
  }

  function notify() {
    var pal = palette();
    subscribers.forEach(function (fn) {
      try { fn(pal); } catch (e) {
        console.error('[theme] subscriber failed:', e);
      }
    });
  }

  function set(dark) {
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('fp-theme', dark ? 'dark' : 'light'); } catch (e) { }
    notify();
  }

  function init(btnId) {
    var stored = null;
    try { stored = localStorage.getItem('fp-theme'); } catch (e) { }
    if (stored === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    var btn = document.getElementById(btnId || 'theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        set(current() !== 'dark');
      });
    }
  }

  var api = { current: current, palette: palette, subscribe: subscribe, set: set, init: init };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.Theme = api;

})(typeof window !== 'undefined' ? window : this);
