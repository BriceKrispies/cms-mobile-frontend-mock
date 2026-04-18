// Minimal hash-based router. Works without a dev server config.
// Route paths may contain :params and are matched greedily.

import { appBus } from '../utils/events.js';

let routes = [];
let outletEl = null;
let currentController = null;

function parseLocation() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [pathname, search = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  return { pathname, query };
}

function matchRoute(pathname) {
  for (const route of routes) {
    const keys = [];
    const pattern = route.path.replace(/:([A-Za-z0-9_]+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    });
    const re = new RegExp('^' + pattern + '/?$');
    const m = pathname.match(re);
    if (m) {
      const params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return { route, params };
    }
  }
  return null;
}

async function dispatchCurrent() {
  if (!outletEl) return;
  const { pathname, query } = parseLocation();
  const matched = matchRoute(pathname);

  if (currentController) {
    try { currentController.abort(); } catch {}
  }
  currentController = new AbortController();

  appBus.emit('route:change', { pathname, query, matched });

  if (!matched) {
    outletEl.innerHTML = `
      <section class="u-container" style="padding-block: var(--space-8)">
        <h1>Not found</h1>
        <p class="u-text-muted">No route matches <code>${pathname}</code>.</p>
        <p><a href="#/">Back to dashboard</a></p>
      </section>
    `;
    return;
  }

  outletEl.innerHTML = '';
  const ctx = {
    outlet: outletEl,
    params: matched.params,
    query,
    pathname,
    signal: currentController.signal,
    navigate,
  };
  try {
    await matched.route.mount(ctx);
  } catch (err) {
    console.error('[router] mount failed', err);
    outletEl.innerHTML = `<section class="u-container"><h1>Something went wrong</h1><pre>${String(err)}</pre></section>`;
  }
}

export function initRouter({ outlet, routes: allRoutes }) {
  outletEl = outlet;
  routes = [...allRoutes].sort((a, b) => b.path.length - a.path.length);
  window.addEventListener('hashchange', dispatchCurrent);
  // Initial kick-off
  if (!window.location.hash) window.location.hash = '#/';
  else dispatchCurrent();
}

export function navigate(path) {
  if (!path.startsWith('#')) path = '#' + (path.startsWith('/') ? path : '/' + path);
  if (window.location.hash === path) dispatchCurrent();
  else window.location.hash = path;
}

export function currentPath() {
  return parseLocation().pathname;
}
