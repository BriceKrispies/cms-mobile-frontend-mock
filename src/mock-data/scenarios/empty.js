import { users } from '../fixtures/users.js';
import { companyValues } from '../fixtures/values.js';

export const emptyScenario = {
  id: 'empty',
  label: 'Fresh install',
  data: {
    users: users.slice(0, 2),
    recognitions: [],
    campaigns: [],
    approvals: [],
    rewards: [],
    companyValues,
    dashboardMetrics: [
      { id: 'm_recognitions', label: 'Recognitions this month', value: '0',  delta: 'New', tone: 'flat' },
      { id: 'm_participation', label: 'Active participation',    value: '0%', delta: 'New', tone: 'flat' },
      { id: 'm_pending',       label: 'Pending approvals',       value: '0',  delta: '—',   tone: 'flat' },
      { id: 'm_points',        label: 'Points redeemed (mo)',    value: '$0', delta: '—',   tone: 'flat' },
    ],
    participationTrend: [
      { week: 'W1', value: 0 }, { week: 'W2', value: 0 }, { week: 'W3', value: 0 }, { week: 'W4', value: 0 },
    ],
    analytics: { sessions: [], pageViews: [], clicks: [] },
  },
};
