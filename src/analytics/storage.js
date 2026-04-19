// Defensive localStorage access for live analytics capture and the
// "acting as" identity. Pattern mirrors /src/schema/storage.js —
// failures are swallowed so the app never blocks on storage state.

const ANALYTICS_KEY = 'cms:analytics';
const ACTING_KEY = 'cms:acting-user-id';

const EMPTY = { sessions: [], pageViews: [], clicks: [] };

// Keep storage bounded so localStorage quota is never a concern.
const MAX_SESSIONS = 200;

export function loadLive() {
  let raw;
  try { raw = localStorage.getItem(ANALYTICS_KEY); } catch { return clone(EMPTY); }
  if (!raw) return clone(EMPTY);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return clone(EMPTY); }
  if (!parsed || typeof parsed !== 'object') return clone(EMPTY);
  return {
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    pageViews: Array.isArray(parsed.pageViews) ? parsed.pageViews : [],
    clicks: Array.isArray(parsed.clicks) ? parsed.clicks : [],
  };
}

export function saveLive(data) {
  // Prune to MAX_SESSIONS most recent; drop orphan page-views/clicks.
  const sessions = [...(data.sessions ?? [])].sort((a, b) => b.startedAt - a.startedAt).slice(0, MAX_SESSIONS);
  const keepIds = new Set(sessions.map((s) => s.id));
  const pageViews = (data.pageViews ?? []).filter((pv) => keepIds.has(pv.sessionId));
  const clicks = (data.clicks ?? []).filter((c) => keepIds.has(c.sessionId));
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify({ sessions, pageViews, clicks }));
  } catch { /* quota or denied — ignore */ }
}

export function getActingUserId() {
  try { return localStorage.getItem(ACTING_KEY) || null; } catch { return null; }
}

export function setActingUserId(id) {
  try {
    if (id) localStorage.setItem(ACTING_KEY, id);
    else localStorage.removeItem(ACTING_KEY);
  } catch { /* ignore */ }
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }
