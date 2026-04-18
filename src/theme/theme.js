// Runtime theme engine. Applies a set of axis values to <html> via
// inline CSS custom properties + data-theme-* attributes. Persists to
// localStorage under `cms:theme`. All storage access is defensive so
// the app keeps working in sandboxed/private contexts.

import { AXES, AXIS_BY_ID, TRACKED_PROPS } from './axes.js';
import { appBus } from '../utils/events.js';

const STORAGE_KEY = 'cms:theme';

function defaults() {
  const out = {};
  for (const axis of AXES) out[axis.id] = axis.default;
  return out;
}

function safeGet() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeSet(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Quota exceeded, private mode, or access denied — ignore.
  }
}

function safeRemove() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

function load() {
  const raw = safeGet();
  if (!raw) return defaults();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults();
  }
  if (!parsed || typeof parsed !== 'object') return defaults();
  const clean = defaults();
  for (const axis of AXES) {
    const candidate = parsed[axis.id];
    if (typeof candidate !== 'string') continue;
    if (axis.options.some((o) => o.id === candidate)) {
      clean[axis.id] = candidate;
    }
  }
  return clean;
}

let state = defaults();
let initialized = false;

function apply() {
  const root = document.documentElement;

  // Clear any previously-tracked inline overrides so options that no
  // longer apply don't linger (e.g. sunset → ocean).
  for (const prop of TRACKED_PROPS) {
    root.style.removeProperty(prop);
  }

  for (const axis of AXES) {
    const value = state[axis.id] ?? axis.default;
    const option =
      axis.options.find((o) => o.id === value) ??
      axis.options.find((o) => o.id === axis.default);
    root.setAttribute(`data-theme-${axis.id}`, option.id);
    for (const [prop, v] of Object.entries(option.vars || {})) {
      root.style.setProperty(prop, v);
    }
  }
}

export function initTheme() {
  if (initialized) return;
  initialized = true;

  // Set mode="auto" on <html> unconditionally before any other work so
  // the dark-mode "auto" / :not([data-theme-mode]) CSS branches match
  // even if a later step throws.
  try {
    document.documentElement.setAttribute('data-theme-mode', 'auto');
  } catch {
    // documentElement should always exist; this is paranoia.
  }

  state = load();
  apply();
}

export function getTheme() {
  return { ...state };
}

export function listAxes() {
  return AXES;
}

export function setTheme(partial) {
  if (!partial || typeof partial !== 'object') return;
  let changed = false;
  for (const [id, value] of Object.entries(partial)) {
    const axis = AXIS_BY_ID[id];
    if (!axis) continue;
    if (!axis.options.some((o) => o.id === value)) continue;
    if (state[id] !== value) {
      state[id] = value;
      changed = true;
    }
  }
  if (!changed) return;
  apply();
  safeSet(JSON.stringify(state));
  appBus.emit('theme:change', { ...state });
}

export function resetTheme() {
  state = defaults();
  apply();
  safeRemove();
  appBus.emit('theme:change', { ...state });
}
