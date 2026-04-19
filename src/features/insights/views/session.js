// /insights/analytics/session/:sessionId — chronological timeline of
// page views and clicks for a single session.

import { mockApi } from '../../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../../utils/dom.js';
import { appBus } from '../../../utils/events.js';
import { navigate } from '../../../app/router.js';
import {
  ensureInsightsStyle,
  tabStripHtml,
  formatDurationMs,
  formatAbsoluteTime,
  formatClockTime,
} from './chrome.js';

export async function mountSession({ outlet, params, signal }) {
  ensureInsightsStyle();
  const sessionId = params.sessionId;

  const draw = async () => {
    const [session, pageViews, clicks] = await Promise.all([
      mockApi.getSession(sessionId),
      mockApi.listPageViews({ sessionId }),
      mockApi.listClicks({ sessionId }),
    ]);
    if (signal?.aborted) return;

    // Build the entire page detached so page-header's connectedCallback
    // sees its [slot="actions"] children when it runs on attach.
    const wrap = document.createElement('section');
    wrap.className = 'u-container insights';

    if (!session) {
      wrap.innerHTML = `
        <page-header eyebrow="Insights · Analytics" title="Session not found" description="This session may have been cleared."></page-header>
        ${tabStripHtml('analytics')}
        <div class="insights-empty">
          Session <code>${escapeHtml(sessionId)}</code> not found.
          <div style="margin-top:var(--space-2)">
            <button type="button" class="insights-linklike" id="ses-back">Back to analytics</button>
          </div>
        </div>
      `;
      outlet.replaceChildren(wrap);
      wrap.querySelector('#ses-back')?.addEventListener('click', () => navigate('/insights/analytics'));
      return;
    }

    const user = session.user;
    const desc = `${formatAbsoluteTime(session.startedAt)} → ${formatAbsoluteTime(session.endedAt ?? session.startedAt)} · ${formatDurationMs(session.durationMs)} · ${session.source}`;

    wrap.innerHTML = `
      <page-header
        eyebrow="Insights · Analytics"
        title="Session · ${escapeHtml(user?.name ?? 'Unknown')}"
        description="${escapeHtml(desc)}">
        <div slot="actions">
          <ui-button variant="ghost" id="ses-user">View user journey</ui-button>
          <ui-button variant="ghost" id="ses-back">← Back to analytics</ui-button>
        </div>
      </page-header>

      ${tabStripHtml('analytics')}

      <ui-grid cols="3" gap="4">
        <metric-card label="Page views" value="${pageViews.length}" tone="flat"></metric-card>
        <metric-card label="Clicks" value="${clicks.length}" tone="flat"></metric-card>
        <metric-card label="Duration" value="${escapeHtml(formatDurationMs(session.durationMs))}" tone="flat"></metric-card>
      </ui-grid>

      <ui-card>
        <span slot="title">Timeline</span>
        <div class="insights-timeline" id="ses-timeline"></div>
        ${session.userAgent ? `<p class="u-text-muted u-text-sm" style="margin-top:var(--space-3)">User agent: <code>${escapeHtml(truncate(session.userAgent, 120))}</code></p>` : ''}
      </ui-card>
    `;

    outlet.replaceChildren(wrap);

    wrap.querySelector('#ses-user')?.addEventListener('click', () => navigate(`/insights/analytics/user/${encodeURIComponent(session.userId)}`));
    wrap.querySelector('#ses-back')?.addEventListener('click', () => navigate('/insights/analytics'));

    renderTimeline(wrap.querySelector('#ses-timeline'), pageViews, clicks);
  };

  await draw();

  const off = [
    appBus.on('analytics:change', draw),
    appBus.on('mock:scenario-changed', draw),
  ];
  signal?.addEventListener('abort', () => off.forEach((fn) => fn()));
}

function renderTimeline(el, pageViews, clicks) {
  if (!el) return;
  if (!pageViews.length && !clicks.length) {
    el.innerHTML = `<div class="insights-empty">No activity in this session.</div>`;
    return;
  }

  // Merge events into a single chronological stream.
  const items = [
    ...pageViews.map((pv) => ({ kind: 'pageview', ts: pv.enteredAt, pv })),
    ...clicks.map((c) => ({ kind: 'click', ts: c.timestamp, c })),
  ].sort((a, b) => a.ts - b.ts);

  el.innerHTML = items.map((it) => {
    const time = escapeHtml(formatClockTime(it.ts));
    if (it.kind === 'pageview') {
      const pv = it.pv;
      return `
        <div class="insights-timeline__item" data-kind="pageview">
          <span class="insights-timeline__time">${time}</span>
          <span class="insights-timeline__title">${escapeHtml(pv.title || pv.route)}</span>
          <span class="insights-timeline__meta">
            <code>${escapeHtml(pv.path)}</code> · dwell ${escapeHtml(formatDurationMs(pv.durationMs))}
          </span>
        </div>
      `;
    }
    const c = it.c;
    return `
      <div class="insights-timeline__item" data-kind="click">
        <span class="insights-timeline__time">${time}</span>
        <span class="insights-timeline__title">Clicked ${escapeHtml(c.label)}</span>
        <span class="insights-timeline__meta">
          ${escapeHtml(c.feature)} · <code>${escapeHtml(c.selector)}</code>
        </span>
      </div>
    `;
  }).join('');
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
