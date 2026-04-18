// Centralized mock API. ALL features must go through this module.
// Features must not import fixtures/factories directly.

import { scenarios } from '../scenarios/index.js';
import { appBus } from '../../utils/events.js';

const STORAGE_KEY = 'cms:scenario';
const initial = localStorage.getItem(STORAGE_KEY) || 'default';

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

function joinUser(id) {
  return db().users.find((u) => u.id === id) ?? { id, name: 'Unknown' };
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
    localStorage.setItem(STORAGE_KEY, id);
    appBus.emit('mock:scenario-changed', { scenarioId: id });
  },
  setLatency(ms) { state.latencyMs = Math.max(0, ms | 0); },
  setFailRate(rate) { state.failRate = Math.min(1, Math.max(0, rate)); },

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
      let rows = db().campaigns;
      if (status) rows = rows.filter((c) => c.status === status);
      return rows;
    });
  },

  // People
  listPeople({ search, team } = {}) {
    return call('listPeople', () => {
      let rows = db().users;
      if (team) rows = rows.filter((u) => u.team === team);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter((u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.team.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      }
      return rows;
    });
  },
  listTeams() {
    return call('listTeams', () => {
      const set = new Set(db().users.map((u) => u.team));
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
