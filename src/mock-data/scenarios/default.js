import { users } from '../fixtures/users.js';
import { recognitions } from '../fixtures/recognitions.js';
import { campaigns } from '../fixtures/campaigns.js';
import { approvals } from '../fixtures/approvals.js';
import { rewards } from '../fixtures/rewards.js';
import { dashboardMetrics, participationTrend } from '../fixtures/metrics.js';
import { companyValues } from '../fixtures/values.js';
import { makeAnalyticsSessions } from '../fixtures/analytics.js';

const analytics = makeAnalyticsSessions(users, { count: 30, daysBack: 30, seed: 1 });

export const defaultScenario = {
  id: 'default',
  label: 'Typical activity',
  data: { users, recognitions, campaigns, approvals, rewards, dashboardMetrics, participationTrend, companyValues, analytics },
};
