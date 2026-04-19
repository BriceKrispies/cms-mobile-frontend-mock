// App bootstrap. Imports primitives (so they register), features, then starts the router.

import './layout.js';

// Primitives — importing ensures custom elements are defined before first render.
import '../primitives/button/button.js';
import '../primitives/input/input.js';
import '../primitives/card/card.js';
import '../primitives/badge/badge.js';
import '../primitives/stack/stack.js';
import '../primitives/grid/grid.js';
import '../primitives/modal/modal.js';
import '../primitives/drawer/drawer.js';
import '../primitives/tabs/tabs.js';
import '../primitives/table/table.js';

// Composites
import '../composites/page-header/page-header.js';
import '../composites/metric-card/metric-card.js';
import '../composites/recognition-card/recognition-card.js';
import '../composites/filter-bar/filter-bar.js';
import '../composites/data-table-shell/data-table-shell.js';
import '../composites/group-summary/group-summary.js';
import '../composites/group-builder/group-builder.js';
import '../composites/group-picker/group-picker.js';

// App-level stylesheet (after tokens so it can reference variables)
const appStyle = document.createElement('link');
appStyle.rel = 'stylesheet';
appStyle.href = new URL('./app.css', import.meta.url).href;
document.head.appendChild(appStyle);

// Register all features
import '../features/dashboard/index.js';
import '../features/recognitions/index.js';
import '../features/messages/index.js';
import '../features/approvals/index.js';
import '../features/campaigns/index.js';
import '../features/people/index.js';
import '../features/rewards/index.js';
import '../features/insights/index.js';
import '../features/schema/index.js';
import '../features/groups/index.js';
import '../features/settings/index.js';

import { initRouter } from './router.js';
import { getRoutes } from './registry.js';
import { initTracker } from '../analytics/tracker.js';
import { getActingUserId, setActingUserId } from '../analytics/storage.js';
import { scenarios } from '../mock-data/scenarios/index.js';
import { mockApi } from '../mock-data/api/mockApi.js';

function ensureActingUser() {
  if (getActingUserId()) return;
  const scenarioId = mockApi.getScenario();
  const users = scenarios[scenarioId]?.data?.users ?? [];
  if (users[0]?.id) setActingUserId(users[0].id);
}

export function bootstrap() {
  const root = document.querySelector('app-root');
  if (!root) throw new Error('No <app-root> element found');

  ensureActingUser();
  initTracker();

  // Wait a microtask for custom element upgrade to attach the outlet.
  queueMicrotask(() => {
    const outlet = root.mountPoint ?? root.querySelector('#app-outlet');
    initRouter({ outlet, routes: getRoutes() });
  });
}
