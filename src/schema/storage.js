// Defensive localStorage access for the schema overrides. Pattern
// mirrors /src/theme/theme.js and /src/mock-data/api/mockApi.js —
// failures are swallowed so the app never blocks on storage state.

const STORAGE_KEY = 'cms:schema';

const EMPTY = { user: [], patches: {} };

export function loadOverrides() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (!raw) return EMPTY;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (!parsed || typeof parsed !== 'object') return EMPTY;
  return {
    user: Array.isArray(parsed.user) ? parsed.user : [],
    patches: parsed.patches && typeof parsed.patches === 'object' ? parsed.patches : {},
  };
}

export function saveOverrides(overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Quota exceeded, private mode, or access denied — ignore.
  }
}

export function clearOverrides() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
