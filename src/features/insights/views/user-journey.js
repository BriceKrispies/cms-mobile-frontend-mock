// /insights/analytics/user/:userId — per-user analytics with KPIs,
// journey map (ordered route visits from the user's most-recent
// session), and sessions table filtered to this user.

import { mockApi } from '../../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../../utils/dom.js';
import { appBus } from '../../../utils/events.js';
import { navigate } from '../../../app/router.js';
import {
  ensureInsightsStyle,
  tabStripHtml,
  formatDurationMs,
  formatAbsoluteTime,
} from './chrome.js';

export async function mountUserJourney({ outlet, params, signal }) {
  ensureInsightsStyle();
  const userId = params.userId;

  const draw = async () => {
    const [user, metrics, sessions] = await Promise.all([
      mockApi.getUser(userId),
      mockApi.getAnalyticsMetrics({ userId }),
      mockApi.listSessions({ userId }),
    ]);
    if (signal?.aborted) return;

    const descParts = [user?.title, user?.team].filter(Boolean);
    const desc = descParts.length ? descParts.join(' · ') : 'User journey';

    // Build detached so page-header's connectedCallback sees its slotted children.
    const wrap = document.createElement('section');
    wrap.className = 'u-container insights';
    wrap.innerHTML = `
      <page-header
        eyebrow="Insights · Analytics"
        title="${escapeHtml(user?.name ?? 'Unknown user')}"
        description="${escapeHtml(desc)}">
        <div slot="actions">
          <ui-button variant="ghost" id="uj-back">← Back to analytics</ui-button>
        </div>
      </page-header>

      ${tabStripHtml('analytics')}

      <ui-grid cols="4" gap="4">
        <metric-card label="Sessions" value="${metrics.totalSessions}" tone="flat"></metric-card>
        <metric-card label="Page views" value="${metrics.totalPageViews}" tone="flat"></metric-card>
        <metric-card label="Clicks" value="${metrics.totalClicks}" tone="flat"></metric-card>
        <metric-card label="Avg session" value="${escapeHtml(formatDurationMs(metrics.avgSessionDurationMs))}" tone="flat"></metric-card>
      </ui-grid>

      <ui-card>
        <span slot="title">Recent journey</span>
        <div id="uj-journey"></div>
        <small class="u-text-muted">Routes visited during this user's most recent session, in order.</small>
      </ui-card>

      <div id="uj-sessions"></div>
    `;

    outlet.replaceChildren(wrap);

    wrap.querySelector('#uj-back')?.addEventListener('click', () => navigate('/insights/analytics'));

    await renderJourney(wrap.querySelector('#uj-journey'), sessions);
    renderSessionsTable(wrap.querySelector('#uj-sessions'), sessions);
  };

  await draw();

  const off = [
    appBus.on('analytics:change', draw),
    appBus.on('mock:scenario-changed', draw),
  ];
  signal?.addEventListener('abort', () => off.forEach((fn) => fn()));
}

async function renderJourney(el, sessions) {
  if (!el) return;
  if (!sessions.length) {
    el.innerHTML = `<div class="insights-empty">No sessions recorded for this user yet.</div>`;
    return;
  }
  const mostRecent = sessions[0];
  const pageViews = await mockApi.listPageViews({ sessionId: mostRecent.id });
  if (!pageViews.length) {
    el.innerHTML = `<div class="insights-empty">This session has no page views.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="insights-journey">
      ${pageViews.map((pv, i) => `
        ${i === 0 ? '' : `<span class="insights-journey__arrow" aria-hidden="true">→</span>`}
        <div class="insights-journey__step">
          <span class="insights-journey__step-label">${escapeHtml(pv.title || pv.route)}</span>
          <span class="insights-journey__step-meta">${escapeHtml(pv.route)} · ${escapeHtml(formatDurationMs(pv.durationMs))}</span>
        </div>
      `).join('')}
    </div>
    <p class="u-text-muted u-text-sm" style="margin-top:var(--space-3)">
      Session started ${escapeHtml(formatAbsoluteTime(mostRecent.startedAt))} · ${pageViews.length} page view${pageViews.length === 1 ? '' : 's'}.
    </p>
  `;
}

function renderSessionsTable(slot, sessions) {
  if (!slot) return;
  slot.innerHTML = '';
  const shell = document.createElement('data-table-shell');
  shell.setAttribute('title', 'Sessions');
  shell.setAttribute('count', String(sessions.length));
  shell.columns = [
    {
      key: 'startedAt', label: 'Started', priority: 'title', sortable: true, type: 'date',
      sortValue: (r) => r.startedAt,
      render: (r) => escapeHtml(formatAbsoluteTime(r.startedAt)),
    },
    {
      key: 'durationMs', label: 'Duration', priority: 'subtitle', sortable: true, type: 'number',
      sortValue: (r) => r.durationMs,
      render: (r) => escapeHtml(formatDurationMs(r.durationMs)),
    },
    { key: 'pageViewCount', label: 'Page views', sortable: true, type: 'number', render: (r) => String(r.pageViewCount) },
    { key: 'clickCount',    label: 'Clicks',     sortable: true, type: 'number', render: (r) => String(r.clickCount) },
    { key: 'source',        label: 'Source',     sortable: true, filter: 'enum', render: (r) => escapeHtml(r.source) },
  ];
  shell.rows = sessions;
  shell.addEventListener('row-click', (e) => {
    const id = e.detail.row?.id;
    if (id) navigate(`/insights/analytics/session/${encodeURIComponent(id)}`);
  });
  slot.appendChild(shell);
}
