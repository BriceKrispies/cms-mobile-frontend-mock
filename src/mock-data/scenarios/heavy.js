import { users } from '../fixtures/users.js';
import { recognitions } from '../fixtures/recognitions.js';
import { campaigns } from '../fixtures/campaigns.js';
import { approvals } from '../fixtures/approvals.js';
import { rewards } from '../fixtures/rewards.js';
import { companyValues } from '../fixtures/values.js';
import { makeUsers } from '../factories/user.js';
import { makeRecognitions } from '../factories/recognition.js';

const extraUsers = makeUsers(40);
const pool = [...users, ...extraUsers];

function rngRecs(n, status) {
  return Array.from({ length: n }, () => {
    const a = pool[Math.floor(Math.random() * pool.length)];
    let b = pool[Math.floor(Math.random() * pool.length)];
    if (a.id === b.id) b = pool[(pool.indexOf(a) + 1) % pool.length];
    return makeRecognitions(1, { fromId: a.id, toId: b.id, status })[0];
  });
}

export const heavyScenario = {
  id: 'heavy',
  label: 'High-volume enterprise',
  data: {
    users: pool,
    recognitions: [
      ...recognitions,
      ...rngRecs(120, 'approved'),
      ...rngRecs(15, 'pending'),
    ],
    campaigns,
    approvals,
    rewards,
    companyValues,
    dashboardMetrics: [
      { id: 'm_recognitions', label: 'Recognitions this month', value: '12,840', delta: '+24% vs. last month', tone: 'up' },
      { id: 'm_participation', label: 'Active participation',    value: '89%',    delta: '+7 pts',              tone: 'up' },
      { id: 'm_pending',       label: 'Pending approvals',       value: '47',     delta: '+12 vs. last week',   tone: 'up' },
      { id: 'm_points',        label: 'Points redeemed (mo)',    value: '$48,210', delta: '+8%',                tone: 'up' },
    ],
    participationTrend: [
      { week: 'W1', value: 74 }, { week: 'W2', value: 79 }, { week: 'W3', value: 84 }, { week: 'W4', value: 89 },
    ],
  },
};
