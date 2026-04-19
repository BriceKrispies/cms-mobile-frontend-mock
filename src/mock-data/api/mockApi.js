// Centralized mock API. ALL features must go through this module.
// Features must not import fixtures/factories directly.

import { scenarios } from '../scenarios/index.js';
import { appBus } from '../../utils/events.js';
import * as schema from '../../schema/index.js';
import * as groups from '../../groups/index.js';

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
};
