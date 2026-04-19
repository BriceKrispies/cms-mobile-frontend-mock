// Defensive localStorage access for group overrides. Mirrors
// /src/schema/storage.js — failures swallow silently so the app
// never blocks on storage state. Stored shape:
//   { user: Group[], patches: { [seedId]: { name?, description? } } }

const STORAGE_KEY = 'cms:groups';

const EMPTY = { user: [], patches: {} };

export function loadOverrides() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { return EMPTY; }
  if (!raw) return EMPTY;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return EMPTY; }
  if (!parsed || typeof parsed !== 'object') return EMPTY;
  return {
    user: Array.isArray(parsed.user) ? parsed.user : [],
    patches: parsed.patches && typeof parsed.patches === 'object' ? parsed.patches : {},
  };
}

export function saveOverrides(overrides) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); }
  catch { /* quota / private mode — ignore */ }
}

export function clearOverrides() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
