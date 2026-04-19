// Synthetic analytics fixtures for the Insights → Analytics feature.
// Each scenario seeds a plausible session/pageView/click log so the
// dashboard has signal before the user generates any live activity.

// Weighted route catalog — what pages users plausibly visit, and what
// labels they plausibly click once there. Kept small and opinionated
// so "top feature" rankings tell a coherent story.
const ROUTE_CATALOG = [
  { route: '/',                   title: 'Dashboard',             weight: 20, clicks: ['Give recognition', 'View all recognitions →', 'Scenario: default'] },
  { route: '/people',             title: 'People',                weight: 18, clicks: ['All teams', 'Brand', 'Platform', 'People row', 'Search'] },
  { route: '/recognitions',       title: 'Recognitions',          weight: 15, clicks: ['Give recognition', 'Approve', 'Recognition card', 'Filter: Pending'] },
  { route: '/recognitions/new',   title: 'Recognitions · New',    weight: 6,  clicks: ['Select recipient', 'Add value', 'Submit'] },
  { route: '/approvals',          title: 'Approvals',             weight: 10, clicks: ['Approve', 'Reject', 'Open recognition'] },
  { route: '/campaigns',          title: 'Campaigns',             weight: 8,  clicks: ['New campaign', 'Campaign card'] },
  { route: '/campaigns/new',      title: 'Campaigns · New',       weight: 3,  clicks: ['Audience', 'Save changes'] },
  { route: '/groups',             title: 'Groups',                weight: 7,  clicks: ['New group', 'Groups row', 'Edit group'] },
  { route: '/groups/new',         title: 'Groups · New',          weight: 2,  clicks: ['Add rule', 'Save changes'] },
  { route: '/schema',             title: 'Schema',                weight: 5,  clicks: ['Add field', 'Schema row'] },
  { route: '/rewards',            title: 'Rewards',               weight: 6,  clicks: ['Reward card', 'Filter: Gift cards', 'Redeem'] },
  { route: '/settings',           title: 'Settings',              weight: 4,  clicks: ['Save changes', 'Discard', 'Scenario: default'] },
];

const SOURCE = 'seed';

export function makeAnalyticsSessions(users, { count = 30, daysBack = 30, seed = 1 } = {}) {
  if (!users.length || !count) return { sessions: [], pageViews: [], clicks: [] };

  const rng = mulberry32(seed);
  const now = Date.now();
  const windowMs = daysBack * 24 * 60 * 60 * 1000;

  const sessions = [];
  const pageViews = [];
  const clicks = [];

  // Distribute sessions across a pool of "active" users so some users
  // get more than one session.
  const activePool = pickWeightedUsers(users, count, rng);

  for (let i = 0; i < count; i++) {
    const user = activePool[i];
    const startedAt = now - Math.floor(rng() * windowMs);
    const session = {
      id: `seed_s_${i}_${hash(user.id + i)}`,
      userId: user.id,
      source: SOURCE,
      startedAt,
      endedAt: startedAt, // fill in after last event
      pageViewIds: [],
      clickIds: [],
      userAgent: '',
    };

    const numViews = 3 + Math.floor(rng() * 10); // 3..12
    let cursor = startedAt;

    for (let v = 0; v < numViews; v++) {
      const route = pickWeighted(ROUTE_CATALOG, rng);
      const dwellMs = 3000 + Math.floor(rng() * 180000); // 3s..3m
      const enteredAt = cursor;
      const leftAt = enteredAt + dwellMs;

      const pv = {
        id: `seed_pv_${i}_${v}_${hash(user.id + i + v)}`,
        sessionId: session.id,
        userId: user.id,
        path: route.route,
        route: route.route,
        title: route.title,
        enteredAt,
        leftAt,
        durationMs: dwellMs,
      };
      pageViews.push(pv);
      session.pageViewIds.push(pv.id);

      const numClicks = Math.floor(rng() * 6); // 0..5
      for (let k = 0; k < numClicks; k++) {
        const label = route.clicks[Math.floor(rng() * route.clicks.length)];
        const t = enteredAt + Math.floor(rng() * dwellMs);
        const click = {
          id: `seed_ck_${i}_${v}_${k}_${hash(user.id + i + v + k)}`,
          sessionId: session.id,
          userId: user.id,
          timestamp: t,
          path: route.route,
          route: route.route,
          feature: featureFromRoute(route.route),
          label,
          tag: 'button',
          selector: 'ui-button',
        };
        clicks.push(click);
        session.clickIds.push(click.id);
      }

      cursor = leftAt + Math.floor(rng() * 2000);
    }

    session.endedAt = cursor;
    sessions.push(session);
  }

  return { sessions, pageViews, clicks };
}

// --- helpers ---

function featureFromRoute(route) {
  const seg = route.split('/').filter(Boolean);
  return seg[0] ?? 'dashboard';
}

function pickWeighted(list, rng) {
  const total = list.reduce((acc, it) => acc + (it.weight ?? 1), 0);
  let r = rng() * total;
  for (const item of list) {
    r -= (item.weight ?? 1);
    if (r <= 0) return item;
  }
  return list[list.length - 1];
}

function pickWeightedUsers(users, n, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(users[Math.floor(rng() * users.length)]);
  }
  return out;
}

// Tiny deterministic PRNG so scenarios render identically across reloads.
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(36);
}
