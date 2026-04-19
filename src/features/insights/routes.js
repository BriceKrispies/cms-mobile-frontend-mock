import { mountReporting } from './views/reporting.js';
import { mountAnalytics } from './views/analytics.js';
import { mountUserJourney } from './views/user-journey.js';
import { mountSession } from './views/session.js';

// /insights lands on reporting — the entry point users click from nav.
function mountIndex(ctx) {
  ctx.navigate('/insights/reporting');
}

export const routes = [
  { path: '/insights',                             mount: mountIndex },
  { path: '/insights/reporting',                   mount: mountReporting },
  { path: '/insights/analytics',                   mount: mountAnalytics },
  { path: '/insights/analytics/user/:userId',      mount: mountUserJourney },
  { path: '/insights/analytics/session/:sessionId', mount: mountSession },
];
