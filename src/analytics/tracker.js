// Live analytics instrumentation.
//
// Listens to router route-change events and capture-phase clicks on
// the document, builds a session/pageView/click log, and persists it
// to localStorage. All captured data is marked source:'live' so the
// mockApi can merge it transparently with seeded fixtures.
//
// Session boundary: 30 minutes of inactivity closes the current
// session; the next tracked event opens a new one.

import { appBus } from '../utils/events.js';
import { loadLive, saveLive, getActingUserId } from './storage.js';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 500;

const state = {
  started: false,
  sessions: [],
  pageViews: [],
  clicks: [],
  current: null,          // active Session (ref into state.sessions)
  currentView: null,      // active PageView (ref into state.pageViews)
  idleTimer: null,
  saveTimer: null,
};

export function initTracker() {
  if (state.started) return;
  state.started = true;

  const loaded = loadLive();
  state.sessions = loaded.sessions;
  state.pageViews = loaded.pageViews;
  state.clicks = loaded.clicks;

  // Any session still open from a previous tab is stale — close it so
  // dwell/duration stops accruing against it.
  for (const s of state.sessions) {
    if (s.endedAt == null) s.endedAt = s.startedAt;
  }
  for (const pv of state.pageViews) {
    if (pv.leftAt == null) {
      pv.leftAt = pv.enteredAt;
      pv.durationMs = 0;
    }
  }

  appBus.on('route:change', onRouteChange);
  document.addEventListener('click', onClickCapture, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

// Accessor used by mockApi to merge live + seeded data.
export function getLiveData() {
  return {
    sessions: state.sessions,
    pageViews: state.pageViews,
    clicks: state.clicks,
  };
}

// --- event handlers ---

function onRouteChange({ pathname, matched }) {
  const userId = getActingUserId();
  if (!userId) return;

  ensureSession(userId);
  closeCurrentView();

  const route = matched?.route?.path ?? pathname;
  const pv = {
    id: uid('pv'),
    sessionId: state.current.id,
    userId,
    path: pathname,
    route,
    title: deriveTitle(pathname, route),
    enteredAt: Date.now(),
    leftAt: null,
    durationMs: 0,
  };
  state.pageViews.push(pv);
  state.current.pageViewIds.push(pv.id);
  state.currentView = pv;

  scheduleSave();
  emitChange();
}

function onClickCapture(ev) {
  if (!ev.isTrusted) return;
  if (typeof ev.button === 'number' && ev.button !== 0) return;

  const userId = getActingUserId();
  if (!userId) return;

  const target = findTrackable(ev.composedPath());
  if (!target) return;

  // Suppress the insights tab strip to reduce self-referential noise.
  if (target.closest && target.closest('.insights-tabs')) return;

  const path = getCurrentPath();
  const feature = featureFromPath(path);

  ensureSession(userId);

  // Click with no open page view (fresh session / post-idle) — open one.
  if (!state.currentView || state.currentView.sessionId !== state.current.id) {
    const pv = {
      id: uid('pv'),
      sessionId: state.current.id,
      userId,
      path,
      route: path,
      title: deriveTitle(path, path),
      enteredAt: Date.now(),
      leftAt: null,
      durationMs: 0,
    };
    state.pageViews.push(pv);
    state.current.pageViewIds.push(pv.id);
    state.currentView = pv;
  }

  const click = {
    id: uid('ck'),
    sessionId: state.current.id,
    userId,
    timestamp: Date.now(),
    path,
    route: state.currentView.route,
    feature,
    label: labelFor(target),
    tag: (target.tagName || '').toLowerCase(),
    selector: selectorFor(target),
  };
  state.clicks.push(click);
  state.current.clickIds.push(click.id);

  scheduleSave();
  emitChange();
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    closeCurrentView();
    scheduleSave();
  }
}

// --- session / view lifecycle ---

function ensureSession(userId) {
  const now = Date.now();

  if (state.current && now - lastActivityAt() > IDLE_TIMEOUT_MS) {
    closeCurrentSession();
  }

  if (!state.current || state.current.userId !== userId) {
    if (state.current) closeCurrentSession();
    const s = {
      id: uid('s'),
      userId,
      source: 'live',
      startedAt: now,
      endedAt: null,
      pageViewIds: [],
      clickIds: [],
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
    state.sessions.push(s);
    state.current = s;
    state.currentView = null;
  }

  armIdleTimer();
}

function closeCurrentView() {
  if (!state.currentView) return;
  if (state.currentView.leftAt == null) {
    state.currentView.leftAt = Date.now();
    state.currentView.durationMs = Math.max(0, state.currentView.leftAt - state.currentView.enteredAt);
  }
  state.currentView = null;
}

function closeCurrentSession() {
  if (!state.current) return;
  closeCurrentView();
  if (state.current.endedAt == null) state.current.endedAt = lastActivityAt();
  state.current = null;
}

function lastActivityAt() {
  if (!state.current) return 0;
  let last = state.current.startedAt;
  for (const id of state.current.pageViewIds) {
    const pv = state.pageViews.find((p) => p.id === id);
    if (!pv) continue;
    last = Math.max(last, pv.enteredAt, pv.leftAt ?? pv.enteredAt);
  }
  for (const id of state.current.clickIds) {
    const c = state.clicks.find((x) => x.id === id);
    if (c) last = Math.max(last, c.timestamp);
  }
  return last;
}

function armIdleTimer() {
  if (state.idleTimer) clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    closeCurrentSession();
    scheduleSave();
    emitChange();
  }, IDLE_TIMEOUT_MS);
}

function scheduleSave() {
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveLive({ sessions: state.sessions, pageViews: state.pageViews, clicks: state.clicks });
  }, SAVE_DEBOUNCE_MS);
}

function emitChange() {
  appBus.emit('analytics:change', {});
}

// --- small helpers ---

function getCurrentPath() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return hash.split('?')[0];
}

function featureFromPath(path) {
  const seg = (path || '/').split('/').filter(Boolean);
  return seg[0] ?? 'dashboard';
}

function deriveTitle(path, route) {
  if (!path || path === '/') return 'Dashboard';
  const seg = path.split('/').filter(Boolean);
  if (!seg.length) return 'Dashboard';
  const feature = seg[0][0].toUpperCase() + seg[0].slice(1);
  if (seg.length === 1) return feature;
  if (route && /:[A-Za-z0-9_]+/.test(route)) return `${feature} detail`;
  const sub = seg[1][0].toUpperCase() + seg[1].slice(1);
  return `${feature} · ${sub}`;
}

function findTrackable(path) {
  for (const node of path) {
    if (!(node instanceof Element)) continue;
    const tag = node.tagName.toLowerCase();
    if (node.hasAttribute?.('data-track')) return node;
    if (tag === 'a' || tag === 'button' || tag === 'ui-button') return node;
    if (node.getAttribute?.('role') === 'button') return node;
    if (tag === 'option' || tag === 'summary') return node;
  }
  return null;
}

function labelFor(el) {
  const track = el.getAttribute?.('data-track');
  if (track) return track;
  const aria = el.getAttribute?.('aria-label');
  if (aria) return aria;
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
  if (text) return text.length > 60 ? text.slice(0, 60) + '…' : text;
  return `<${el.tagName.toLowerCase()}>`;
}

function selectorFor(el) {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string' && el.className.trim()
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  return `${tag}${id}${cls}`;
}

function uid(prefix) {
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
