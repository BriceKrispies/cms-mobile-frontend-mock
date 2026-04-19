// Centralized mock API. ALL features must go through this module.
// Features must not import fixtures/factories directly.

import { scenarios } from '../scenarios/index.js';
import { appBus } from '../../utils/events.js';
import * as schema from '../../schema/index.js';
import * as groups from '../../groups/index.js';
import { getLiveData } from '../../analytics/tracker.js';

const STORAGE_KEY = 'cms:scenario';
let initial = 'default';
try {
  initial = localStorage.getItem(STORAGE_KEY) || 'default';
} catch { /* fall through to default */ }

const state = {
  scenarioId: scenarios[initial] ? initial : 'default',
  latencyMs: 250,
  failRate: 0,       // 0..1 — occasionally throw to test error paths.
};

function db() { return scenarios[state.scenarioId].data; }

function simulateLatency() {
  if (!state.latencyMs) return Promise.resolve();
  const jitter = (Math.random() * 0.5 + 0.75) * state.latencyMs;
  return new Promise((r) => setTimeout(r, jitter));
}

function maybeFail(op) {
  if (state.failRate > 0 && Math.random() < state.failRate) {
    throw new Error(`mockApi: simulated failure in ${op}`);
  }
}

async function call(op, fn) {
  await simulateLatency();
  maybeFail(op);
  // Return a defensive clone so callers can't mutate fixture state.
  return structuredClone(fn());
}

// Every user leaving the mockApi passes through the schema so callers
// only see declared, coerced fields. Downstream code can trust types.
function cleanUser(user) {
  return schema.validateUser(user);
}

function joinUser(id) {
  const raw = db().users.find((u) => u.id === id);
  return raw ? cleanUser(raw) : { id, name: 'Unknown' };
}

function enrichRecognition(r) {
  return {
    id: r.id,
    from: joinUser(r.fromId),
    to: joinUser(r.toId),
    message: r.message,
    values: r.values,
    points: r.points,
    likes: r.likes,
    status: r.status,
    when: formatRelative(r.createdAt),
    createdAt: r.createdAt,
  };
}

// -------- Campaign helpers: storage + enrichment with group data ---------

const CAMPAIGNS_KEY = 'cms:campaigns';
const CAMPAIGN_ID_RE = /^[a-z][a-zA-Z0-9_]*$/;

function loadUserCampaigns() {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveUserCampaigns() {
  try { localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(userCampaigns)); }
  catch { /* ignore */ }
}
const userCampaigns = loadUserCampaigns();

function cleanIncomingCampaign(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !CAMPAIGN_ID_RE.test(raw.id)) return null;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    id: raw.id,
    name: raw.name.trim(),
    status: ['active', 'draft', 'archived'].includes(raw.status) ? raw.status : 'draft',
    audienceGroupId: typeof raw.audienceGroupId === 'string' ? raw.audienceGroupId : null,
    audienceDefinition: raw.audienceDefinition && typeof raw.audienceDefinition === 'object' ? raw.audienceDefinition : null,
    audience: typeof raw.audience === 'string' ? raw.audience : '',
    startsAt: typeof raw.startsAt === 'string' ? raw.startsAt : '',
    endsAt: typeof raw.endsAt === 'string' ? raw.endsAt : '',
    participation: typeof raw.participation === 'number' ? raw.participation : 0,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function enrichCampaign(c) {
  const out = { ...c };
  if (c.audienceGroupId) {
    const group = groups.getGroup(c.audienceGroupId);
    if (group) {
      const { ids, errors } = groups.resolveGroup(c.audienceGroupId, db().users.map(cleanUser));
      out.audienceGroup = { id: group.id, name: group.name, count: ids.size, errors, source: 'group' };
    } else {
      out.audienceGroup = { id: c.audienceGroupId, name: c.audience || c.audienceGroupId, count: 0, errors: ['Group missing'], source: 'group-missing' };
    }
  } else if (c.audienceDefinition) {
    const { ids, errors } = groups.previewDefinition(c.audienceDefinition, db().users.map(cleanUser));
    out.audienceGroup = { id: null, name: c.audience || 'Custom audience', count: ids.size, errors, source: 'adhoc' };
  } else {
    out.audienceGroup = { id: null, name: c.audience || 'Unspecified', count: 0, errors: [], source: 'legacy' };
  }
  return out;
}

function formatRelative(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// --------------------------- Public API ---------------------------

export const mockApi = {
  // Scenario management
  listScenarios() {
    return Object.values(scenarios).map((s) => ({ id: s.id, label: s.label }));
  },
  getScenario() { return state.scenarioId; },
  setScenario(id) {
    if (!scenarios[id]) throw new Error(`Unknown scenario: ${id}`);
    state.scenarioId = id;
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
    appBus.emit('mock:scenario-changed', { scenarioId: id });
  },
  setLatency(ms) { state.latencyMs = Math.max(0, ms | 0); },
  setFailRate(rate) { state.failRate = Math.min(1, Math.max(0, rate)); },

  // Schema (synchronous — no latency. Same pattern as scenario controls.)
  listFields() { return schema.listFields(); },
  getField(id) { return schema.getField(id); },
  createField(def) {
    const created = schema.createField(def);
    return created;
  },
  updateField(id, patch) {
    return schema.updateField(id, patch);
  },
  deleteField(id) {
    schema.deleteField(id);
  },
  listOperators(type) { return schema.operatorsForType(type); },
  operatorsForField(fieldId) { return schema.operatorsForField(fieldId); },
  formatValue(fieldId, v) { return schema.formatValue(fieldId, v); },

  // Groups (synchronous — no latency. Same pattern as schema.)
  listGroups({ search } = {}) {
    let rows = groups.listGroups();
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description ?? '').toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q)
      );
    }
    return rows;
  },
  getGroup(id) { return groups.getGroup(id); },
  createGroup(def) {
    if (def && def.definition) {
      const errs = groups.validateDefinition(def.definition, { ownerId: def.id });
      if (errs.length) {
        const msg = errs.map((e) => `${e.path}: ${e.message}`).join('; ');
        throw new Error(`Invalid group: ${msg}`);
      }
    }
    return groups.createGroup(def);
  },
  updateGroup(id, patch) {
    if (patch && patch.definition) {
      const errs = groups.validateDefinition(patch.definition, { ownerId: id });
      if (errs.length) {
        const msg = errs.map((e) => `${e.path}: ${e.message}`).join('; ');
        throw new Error(`Invalid group: ${msg}`);
      }
    }
    return groups.updateGroup(id, patch);
  },
  deleteGroup(id) { groups.deleteGroup(id); },
  resolveGroup(id) {
    const users = db().users.map(cleanUser);
    const { ids, errors } = groups.resolveGroup(id, users);
    const matched = users.filter((u) => ids.has(u.id));
    return { users: matched, count: matched.length, errors };
  },
  previewDefinition(definition, { ownerId } = {}) {
    const users = db().users.map(cleanUser);
    const { ids, errors } = groups.previewDefinition(definition, users, { ownerId });
    const matched = users.filter((u) => ids.has(u.id));
    return { users: matched, count: matched.length, errors };
  },
  validateGroupDefinition(definition, { ownerId } = {}) {
    return groups.validateDefinition(definition, { ownerId });
  },

  // Dashboard
  getDashboardMetrics() {
    return call('getDashboardMetrics', () => db().dashboardMetrics);
  },
  getParticipationTrend() {
    return call('getParticipationTrend', () => db().participationTrend);
  },

  // Recognitions
  listRecognitions({ status, search, limit } = {}) {
    return call('listRecognitions', () => {
      let rows = db().recognitions.map(enrichRecognition);
      if (status) rows = rows.filter((r) => r.status === status);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter((r) =>
          r.message.toLowerCase().includes(q) ||
          r.from.name.toLowerCase().includes(q) ||
          r.to.name.toLowerCase().includes(q)
        );
      }
      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (limit) rows = rows.slice(0, limit);
      return rows;
    });
  },
  getRecognition(id) {
    return call('getRecognition', () => {
      const r = db().recognitions.find((x) => x.id === id);
      return r ? enrichRecognition(r) : null;
    });
  },

  // Approvals
  listApprovals({ status = 'pending' } = {}) {
    return call('listApprovals', () => {
      return db().approvals
        .filter((a) => !status || a.status === status)
        .map((a) => ({
          ...a,
          requestedBy: joinUser(a.requestedBy),
          requestedFor: joinUser(a.requestedFor),
        }));
    });
  },

  // Campaigns
  listCampaigns({ status } = {}) {
    return call('listCampaigns', () => {
      let rows = [...db().campaigns, ...userCampaigns];
      if (status) rows = rows.filter((c) => c.status === status);
      return rows.map(enrichCampaign);
    });
  },
  getCampaign(id) {
    return call('getCampaign', () => {
      const raw = [...db().campaigns, ...userCampaigns].find((c) => c.id === id);
      return raw ? enrichCampaign(raw) : null;
    });
  },
  createCampaign(def) {
    const clean = cleanIncomingCampaign(def);
    if (!clean) throw new Error('Invalid campaign');
    const exists = db().campaigns.some((c) => c.id === clean.id) || userCampaigns.some((c) => c.id === clean.id);
    if (exists) throw new Error(`Campaign "${clean.id}" already exists`);
    userCampaigns.push(clean);
    saveUserCampaigns();
    appBus.emit('campaigns:change', { action: 'create', id: clean.id });
    return enrichCampaign(clean);
  },

  // People
  listPeople({ search, team } = {}) {
    return call('listPeople', () => {
      let rows = db().users.map(cleanUser);
      if (team) rows = rows.filter((u) => u.team === team);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter((u) =>
          (u.name ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          (u.team ?? '').toLowerCase().includes(q) ||
          (u.role ?? '').toLowerCase().includes(q) ||
          (u.title ?? '').toLowerCase().includes(q)
        );
      }
      return rows;
    });
  },
  getUser(id) {
    return call('getUser', () => {
      const raw = db().users.find((u) => u.id === id);
      return raw ? cleanUser(raw) : null;
    });
  },
  listTeams() {
    return call('listTeams', () => {
      const set = new Set(db().users.map((u) => u.team).filter(Boolean));
      return [...set].sort();
    });
  },

  // Rewards
  listRewards({ category } = {}) {
    return call('listRewards', () => {
      let rows = db().rewards;
      if (category) rows = rows.filter((r) => r.category === category);
      return rows;
    });
  },

  // Values (used in forms)
  listValues() {
    return call('listValues', () => db().companyValues);
  },

  // Analytics — merges scenario-seeded fixtures with live-captured activity.
  listSessions(opts = {}) {
    return call('listSessions', () => filterSessions(opts));
  },
  getSession(id) {
    return call('getSession', () => {
      const all = allAnalytics();
      const s = all.sessions.find((x) => x.id === id);
      return s ? enrichSession(s) : null;
    });
  },
  listPageViews(opts = {}) {
    return call('listPageViews', () => filterPageViews(opts));
  },
  listClicks(opts = {}) {
    return call('listClicks', () => filterClicks(opts));
  },
  getAnalyticsMetrics(opts = {}) {
    return call('getAnalyticsMetrics', () => computeMetrics(opts));
  },
};

// --------------------------- Analytics internals ---------------------------

function allAnalytics() {
  const seed = db().analytics ?? { sessions: [], pageViews: [], clicks: [] };
  const live = safeLive();
  return {
    sessions: [...seed.sessions, ...live.sessions],
    pageViews: [...seed.pageViews, ...live.pageViews],
    clicks: [...seed.clicks, ...live.clicks],
  };
}

function safeLive() {
  try { return getLiveData(); } catch { return { sessions: [], pageViews: [], clicks: [] }; }
}

function userIdsForAudience({ userId, groupId }) {
  if (userId) return new Set([userId]);
  if (groupId) {
    const users = db().users.map(cleanUser);
    const { ids } = groups.resolveGroup(groupId, users);
    return ids;
  }
  return null; // null === match all
}

function inRange(ts, { since, until }) {
  if (since != null && ts < since) return false;
  if (until != null && ts > until) return false;
  return true;
}

function filterSessions(opts = {}) {
  const all = allAnalytics();
  const audience = userIdsForAudience(opts);
  let rows = all.sessions.filter((s) => {
    if (audience && !audience.has(s.userId)) return false;
    if (opts.source && s.source !== opts.source) return false;
    if (!inRange(s.startedAt, opts)) return false;
    return true;
  });
  rows.sort((a, b) => b.startedAt - a.startedAt);
  rows = rows.map(enrichSession);
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

function filterPageViews(opts = {}) {
  const all = allAnalytics();
  const audience = userIdsForAudience(opts);
  return all.pageViews
    .filter((pv) => {
      if (opts.sessionId && pv.sessionId !== opts.sessionId) return false;
      if (audience && !audience.has(pv.userId)) return false;
      if (!inRange(pv.enteredAt, opts)) return false;
      return true;
    })
    .sort((a, b) => a.enteredAt - b.enteredAt);
}

function filterClicks(opts = {}) {
  const all = allAnalytics();
  const audience = userIdsForAudience(opts);
  return all.clicks
    .filter((c) => {
      if (opts.sessionId && c.sessionId !== opts.sessionId) return false;
      if (audience && !audience.has(c.userId)) return false;
      if (!inRange(c.timestamp, opts)) return false;
      return true;
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function enrichSession(s) {
  const user = joinUser(s.userId);
  const durationMs = Math.max(0, (s.endedAt ?? s.startedAt) - s.startedAt);
  return {
    ...s,
    user,
    durationMs,
    pageViewCount: s.pageViewIds?.length ?? 0,
    clickCount: s.clickIds?.length ?? 0,
  };
}

function computeMetrics(opts = {}) {
  const all = allAnalytics();
  const audience = userIdsForAudience(opts);

  const sessions = all.sessions.filter((s) => {
    if (audience && !audience.has(s.userId)) return false;
    if (!inRange(s.startedAt, opts)) return false;
    return true;
  });
  const pageViews = all.pageViews.filter((pv) => {
    if (audience && !audience.has(pv.userId)) return false;
    if (!inRange(pv.enteredAt, opts)) return false;
    return true;
  });
  const clicks = all.clicks.filter((c) => {
    if (audience && !audience.has(c.userId)) return false;
    if (!inRange(c.timestamp, opts)) return false;
    return true;
  });

  const uniqueUsers = new Set(sessions.map((s) => s.userId)).size;
  const avgSessionDurationMs = sessions.length
    ? sessions.reduce((acc, s) => acc + Math.max(0, (s.endedAt ?? s.startedAt) - s.startedAt), 0) / sessions.length
    : 0;

  // Top pages by visits (aggregate by route).
  const pageAgg = new Map();
  for (const pv of pageViews) {
    const key = pv.route || pv.path;
    const entry = pageAgg.get(key) ?? { route: key, path: pv.path, count: 0, totalDwellMs: 0, title: pv.title };
    entry.count += 1;
    entry.totalDwellMs += pv.durationMs ?? 0;
    pageAgg.set(key, entry);
  }
  const topPages = [...pageAgg.values()]
    .map((e) => ({ route: e.route, path: e.path, title: e.title, count: e.count, avgDwellMs: e.count ? e.totalDwellMs / e.count : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top features by click count, with matching page-view count.
  const featAgg = new Map();
  for (const c of clicks) {
    const e = featAgg.get(c.feature) ?? { feature: c.feature, clickCount: 0, pageViewCount: 0 };
    e.clickCount += 1;
    featAgg.set(c.feature, e);
  }
  for (const pv of pageViews) {
    const f = (pv.route || pv.path).split('/').filter(Boolean)[0] ?? 'dashboard';
    const e = featAgg.get(f) ?? { feature: f, clickCount: 0, pageViewCount: 0 };
    e.pageViewCount += 1;
    featAgg.set(f, e);
  }
  const topFeatures = [...featAgg.values()]
    .sort((a, b) => b.clickCount - a.clickCount || b.pageViewCount - a.pageViewCount)
    .slice(0, 8);

  // Top element labels across clicks.
  const labelAgg = new Map();
  for (const c of clicks) {
    const k = `${c.feature}:${c.label}`;
    const e = labelAgg.get(k) ?? { feature: c.feature, label: c.label, count: 0 };
    e.count += 1;
    labelAgg.set(k, e);
  }
  const topElements = [...labelAgg.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Activity buckets: last 30 days by day.
  const dayBuckets = buildDayBuckets(30);
  const dayKey = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  for (const s of sessions) {
    const k = dayKey(s.startedAt);
    const b = dayBuckets.find((d) => d.date === k);
    if (b) b.sessions += 1;
  }
  for (const c of clicks) {
    const k = dayKey(c.timestamp);
    const b = dayBuckets.find((d) => d.date === k);
    if (b) b.clicks += 1;
  }

  return {
    totalSessions: sessions.length,
    uniqueUsers,
    totalPageViews: pageViews.length,
    totalClicks: clicks.length,
    avgSessionDurationMs,
    topPages,
    topFeatures,
    topElements,
    activityByDay: dayBuckets,
  };
}

function buildDayBuckets(days) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    out.push({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      sessions: 0,
      clicks: 0,
    });
  }
  return out;
}

function pad(n) { return String(n).padStart(2, '0'); }
