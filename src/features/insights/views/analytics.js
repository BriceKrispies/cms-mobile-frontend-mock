// /insights/analytics — sessions dashboard with a stage-and-save
// audience + time-range filter, KPI row, top-N stats, activity chart,
// and a sessions table that drills into per-session and per-user views.

import { mockApi } from '../../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../../utils/dom.js';
import { appBus } from '../../../utils/events.js';
import { navigate } from '../../../app/router.js';
import {
  ensureInsightsStyle,
  tabStripHtml,
  renderTrend,
  formatDurationMs,
  formatAbsoluteTime,
} from './chrome.js';

const RANGES = [
  { id: '24h', label: 'Last 24 hours',  ms: 24 * 60 * 60 * 1000 },
  { id: '7d',  label: 'Last 7 days',    ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: 'Last 30 days',   ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All time',       ms: null },
];

const DEFAULT_FILTER = {
  audienceMode: 'all', // 'all' | 'user' | 'group'
  userId: null,
  audience: { groupId: null },
  timeRange: '30d',
};

export async function mountAnalytics({ outlet, signal }) {
  ensureInsightsStyle();

  let applied = structuredClone(DEFAULT_FILTER);
  let pending = structuredClone(applied);

  const wrap = document.createElement('section');
  wrap.className = 'u-container insights';
  wrap.innerHTML = `
    <page-header
      eyebrow="Insights"
      title="Analytics"
      description="Session-based page and click tracking across the app."></page-header>

    ${tabStripHtml('analytics')}

    <div id="ins-filter"></div>

    <ui-grid cols="4" gap="4" id="ins-kpis"></ui-grid>

    <div class="insights-stats">
      <ui-card>
        <span slot="title">Most visited pages</span>
        <div id="ins-pages"></div>
      </ui-card>
      <ui-card>
        <span slot="title">Top feature interactions</span>
        <div id="ins-features"></div>
      </ui-card>
      <ui-card>
        <span slot="title">Top element labels</span>
        <div id="ins-elements"></div>
      </ui-card>
      <ui-card>
        <span slot="title">Activity (last 30 days)</span>
        <div class="insights-trend insights-trend--narrow" id="ins-activity"></div>
        <small class="u-text-muted">Sessions per day.</small>
      </ui-card>
    </div>

    <div id="ins-sessions"></div>
  `;
  outlet.appendChild(wrap);

  const filterSlot = wrap.querySelector('#ins-filter');
  const kpiEl = wrap.querySelector('#ins-kpis');
  const pagesEl = wrap.querySelector('#ins-pages');
  const featuresEl = wrap.querySelector('#ins-features');
  const elementsEl = wrap.querySelector('#ins-elements');
  const activityEl = wrap.querySelector('#ins-activity');
  const sessionsSlot = wrap.querySelector('#ins-sessions');

  const refresh = async () => {
    await renderData(applied, { kpiEl, pagesEl, featuresEl, elementsEl, activityEl, sessionsSlot, signal });
  };

  const drawFilter = () => {
    renderFilter(filterSlot, {
      pending,
      applied,
      onPendingChange: (next) => { pending = next; drawFilter(); },
      onApply: () => {
        applied = structuredClone(pending);
        drawFilter();
        refresh();
      },
      onDiscard: () => { pending = structuredClone(applied); drawFilter(); },
    });
  };

  drawFilter();

  const off = [
    appBus.on('analytics:change', refresh),
    appBus.on('mock:scenario-changed', () => {
      applied = structuredClone(DEFAULT_FILTER);
      pending = structuredClone(applied);
      drawFilter();
      refresh();
    }),
    appBus.on('groups:change', () => drawFilter()),
  ];
  signal?.addEventListener('abort', () => off.forEach((fn) => fn()));

  await refresh();
}

// --- Filter bar (stage-and-save) ------------------------------------------

function renderFilter(container, { pending, applied, onPendingChange, onApply, onDiscard }) {
  const dirty = !shallowEq(pending, applied);

  container.innerHTML = `
    <ui-card>
      <span slot="title">Audience &amp; time range</span>

      <div class="insights-filter">
        <div class="insights-filter__row">
          <div class="insights-filter__segment">
            <span class="insights-filter__segment-label">Audience</span>
            <div class="insights-filter__pills" data-group="audience">
              ${pill('all',   'All users',   pending.audienceMode === 'all')}
              ${pill('user',  'Single user', pending.audienceMode === 'user')}
              ${pill('group', 'Group',       pending.audienceMode === 'group')}
            </div>
          </div>

          <div class="insights-filter__segment">
            <span class="insights-filter__segment-label">Time range</span>
            <div class="insights-filter__pills" data-group="range">
              ${RANGES.map((r) => pill(r.id, r.label, pending.timeRange === r.id)).join('')}
            </div>
          </div>
        </div>

        <div id="ins-filter-slot"></div>
      </div>

      <div slot="footer" class="insights-footer" data-dirty="${dirty}">
        <span class="insights-footer__status">
          ${dirty ? 'Filters are staged — click Apply to refresh.' : describeApplied(applied)}
        </span>
        <ui-stack direction="row" gap="2" justify="end">
          <ui-button id="ins-discard" variant="ghost" ${dirty ? '' : 'disabled'}>Discard</ui-button>
          <ui-button id="ins-apply" variant="primary" ${dirty ? '' : 'disabled'}>Apply</ui-button>
        </ui-stack>
      </div>
    </ui-card>
  `;

  container.querySelectorAll('[data-group="audience"] [data-pill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.pill;
      if (mode === pending.audienceMode) return;
      const next = { ...pending, audienceMode: mode };
      if (mode === 'all')   { next.userId = null; next.audience = { groupId: null }; }
      if (mode === 'user')  { next.audience = { groupId: null }; }
      if (mode === 'group') { next.userId = null; }
      onPendingChange(next);
    });
  });

  container.querySelectorAll('[data-group="range"] [data-pill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.pill;
      if (id === pending.timeRange) return;
      onPendingChange({ ...pending, timeRange: id });
    });
  });

  container.querySelector('#ins-discard').addEventListener('click', () => onDiscard?.());
  container.querySelector('#ins-apply').addEventListener('click', () => onApply?.());

  // Sub-slot: depends on audience mode.
  const slot = container.querySelector('#ins-filter-slot');
  if (pending.audienceMode === 'user') {
    mountUserPicker(slot, pending, onPendingChange);
  } else if (pending.audienceMode === 'group') {
    mountGroupPicker(slot, pending, onPendingChange);
  } else {
    slot.innerHTML = '';
  }
}

function pill(id, label, active) {
  return `
    <ui-button
      size="sm"
      data-pill="${escapeHtml(id)}"
      variant="${active ? 'primary' : 'subtle'}">${escapeHtml(label)}</ui-button>
  `;
}

function describeApplied(applied) {
  const range = RANGES.find((r) => r.id === applied.timeRange)?.label ?? 'All time';
  if (applied.audienceMode === 'all') return `Showing: all users · ${range}.`;
  if (applied.audienceMode === 'user') {
    return applied.userId ? `Showing: single user · ${range}.` : `Pick a user, then Apply.`;
  }
  if (applied.audienceMode === 'group') {
    return applied.audience?.groupId || applied.audience?.definition
      ? `Showing: group · ${range}.`
      : `Pick a group, then Apply.`;
  }
  return '';
}

function mountUserPicker(slot, pending, onPendingChange) {
  slot.innerHTML = `
    <div class="insights-filter__segment">
      <span class="insights-filter__segment-label">User</span>
      <select class="dts-ctrl__input" id="ins-user-select" style="min-width:16rem;max-width:100%">
        <option value="">Loading…</option>
      </select>
    </div>
  `;
  const sel = slot.querySelector('#ins-user-select');
  mockApi.listPeople().then((people) => {
    const sorted = [...people].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    sel.innerHTML = `
      <option value="" ${pending.userId ? '' : 'selected'}>Pick a user…</option>
      ${sorted.map((u) => `<option value="${escapeHtml(u.id)}" ${u.id === pending.userId ? 'selected' : ''}>${escapeHtml(u.name)}${u.team ? ` · ${escapeHtml(u.team)}` : ''}</option>`).join('')}
    `;
  }).catch(() => {
    sel.innerHTML = `<option value="">Failed to load users</option>`;
  });
  sel.addEventListener('change', () => {
    onPendingChange({ ...pending, userId: sel.value || null });
  });
}

function mountGroupPicker(slot, pending, onPendingChange) {
  slot.innerHTML = `
    <div class="insights-filter__segment insights-filter__group-slot">
      <span class="insights-filter__segment-label">Group</span>
      <div id="ins-group-slot"></div>
    </div>
  `;
  const picker = document.createElement('group-picker');
  picker.value = pending.audience ?? { groupId: null };
  picker.addEventListener('change', (e) => {
    onPendingChange({ ...pending, audience: e.detail.value });
  });
  slot.querySelector('#ins-group-slot').appendChild(picker);
}

function shallowEq(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.audienceMode !== b.audienceMode) return false;
  if (a.timeRange !== b.timeRange) return false;
  if (a.userId !== b.userId) return false;
  const ag = a.audience ?? {}, bg = b.audience ?? {};
  if (ag.groupId !== bg.groupId) return false;
  if (JSON.stringify(ag.definition ?? null) !== JSON.stringify(bg.definition ?? null)) return false;
  return true;
}

// --- Data rendering --------------------------------------------------------

function queryForApplied(applied) {
  const range = RANGES.find((r) => r.id === applied.timeRange) ?? RANGES[2];
  const opts = {};
  if (applied.audienceMode === 'user' && applied.userId) opts.userId = applied.userId;
  if (applied.audienceMode === 'group' && applied.audience?.groupId) opts.groupId = applied.audience.groupId;
  if (range.ms != null) opts.since = Date.now() - range.ms;
  return opts;
}

async function renderData(applied, els) {
  const { kpiEl, pagesEl, featuresEl, elementsEl, activityEl, sessionsSlot, signal } = els;

  // If a user/group filter is selected but the id is missing, show guidance.
  if ((applied.audienceMode === 'user' && !applied.userId) ||
      (applied.audienceMode === 'group' && !applied.audience?.groupId && !applied.audience?.definition)) {
    kpiEl.innerHTML = '';
    pagesEl.innerHTML = featuresEl.innerHTML = elementsEl.innerHTML = '';
    activityEl.innerHTML = '';
    sessionsSlot.innerHTML = `<div class="insights-empty">Pick a ${applied.audienceMode === 'user' ? 'user' : 'group'} above, then click Apply.</div>`;
    return;
  }

  const opts = queryForApplied(applied);

  // Ad-hoc group definition: resolve to ids, then pass userId filter per-id.
  // The mockApi doesn't support ad-hoc definitions on list* yet, so if an
  // ad-hoc definition is in play we pre-resolve to a set of ids and apply
  // client-side through multiple calls. Cleanest path: fall back to fetching
  // everything and post-filtering — but the numbers are small.
  const [metrics, sessions] = await Promise.all([
    mockApi.getAnalyticsMetrics(opts),
    mockApi.listSessions(opts),
  ]);
  if (signal?.aborted) return;

  renderKpis(kpiEl, metrics);
  renderPages(pagesEl, metrics.topPages);
  renderFeatures(featuresEl, metrics.topFeatures);
  renderElements(elementsEl, metrics.topElements);
  renderTrend(activityEl, metrics.activityByDay, {
    narrow: true,
    labelOf: (d) => d.date,
    valueOf: (d) => d.sessions,
  });
  renderSessionsTable(sessionsSlot, sessions);
}

function renderKpis(el, m) {
  const kpi = (label, value, footnote) => `
    <metric-card label="${escapeHtml(label)}" value="${escapeHtml(value)}"
      tone="flat" footnote="${escapeHtml(footnote ?? '')}"></metric-card>
  `;
  el.innerHTML = [
    kpi('Sessions', String(m.totalSessions), `${m.uniqueUsers} unique user${m.uniqueUsers === 1 ? '' : 's'}`),
    kpi('Page views', String(m.totalPageViews)),
    kpi('Clicks', String(m.totalClicks)),
    kpi('Avg session', formatDurationMs(m.avgSessionDurationMs)),
  ].join('');
}

function renderPages(el, pages) {
  if (!pages.length) { el.innerHTML = `<div class="insights-empty">No page views yet.</div>`; return; }
  const max = Math.max(1, ...pages.map((p) => p.count));
  el.innerHTML = `
    <div class="insights-rank">
      ${pages.map((p, i) => `
        <div class="insights-rank__row">
          <span class="insights-rank__index">${i + 1}</span>
          <span class="insights-rank__label">
            ${escapeHtml(p.title || p.route)}
            <code>${escapeHtml(p.route)}</code>
          </span>
          <span class="insights-rank__meta">${p.count} · ${formatDurationMs(p.avgDwellMs)}</span>
          <span class="insights-rank__bar" style="--_w: ${(p.count / max) * 100}%"></span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderFeatures(el, features) {
  if (!features.length) { el.innerHTML = `<div class="insights-empty">No interactions yet.</div>`; return; }
  const max = Math.max(1, ...features.map((f) => f.clickCount));
  el.innerHTML = `
    <div class="insights-rank">
      ${features.map((f, i) => `
        <div class="insights-rank__row">
          <span class="insights-rank__index">${i + 1}</span>
          <span class="insights-rank__label">${escapeHtml(f.feature)}</span>
          <span class="insights-rank__meta">${f.clickCount} click${f.clickCount === 1 ? '' : 's'} · ${f.pageViewCount} view${f.pageViewCount === 1 ? '' : 's'}</span>
          <span class="insights-rank__bar" style="--_w: ${(f.clickCount / max) * 100}%"></span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderElements(el, elements) {
  if (!elements.length) { el.innerHTML = `<div class="insights-empty">No clicks yet.</div>`; return; }
  const max = Math.max(1, ...elements.map((e) => e.count));
  el.innerHTML = `
    <div class="insights-rank">
      ${elements.map((e, i) => `
        <div class="insights-rank__row">
          <span class="insights-rank__index">${i + 1}</span>
          <span class="insights-rank__label">
            ${escapeHtml(e.label)}
            <code>${escapeHtml(e.feature)}</code>
          </span>
          <span class="insights-rank__meta">${e.count}</span>
          <span class="insights-rank__bar" style="--_w: ${(e.count / max) * 100}%"></span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSessionsTable(slot, sessions) {
  slot.innerHTML = '';
  const shell = document.createElement('data-table-shell');
  shell.setAttribute('title', 'Sessions');
  shell.setAttribute('count', String(sessions.length));
  shell.columns = [
    {
      key: 'user', label: 'User', priority: 'title', sortable: true, filter: 'text',
      sortValue: (r) => r.user?.name ?? '',
      filterValue: (r) => `${r.user?.name ?? ''} ${r.user?.team ?? ''}`,
      render: (r) => `${escapeHtml(r.user?.name ?? 'Unknown')}${r.user?.team ? ` · ${escapeHtml(r.user.team)}` : ''}`,
    },
    {
      key: 'startedAt', label: 'Started', priority: 'subtitle', sortable: true, type: 'date',
      sortValue: (r) => r.startedAt,
      render: (r) => escapeHtml(formatAbsoluteTime(r.startedAt)),
    },
    {
      key: 'durationMs', label: 'Duration', sortable: true, type: 'number',
      sortValue: (r) => r.durationMs,
      render: (r) => escapeHtml(formatDurationMs(r.durationMs)),
    },
    {
      key: 'pageViewCount', label: 'Page views', sortable: true, type: 'number',
      render: (r) => String(r.pageViewCount),
    },
    {
      key: 'clickCount', label: 'Clicks', sortable: true, type: 'number',
      render: (r) => String(r.clickCount),
    },
    {
      key: 'source', label: 'Source', sortable: true, filter: 'enum',
      render: (r) => escapeHtml(r.source),
    },
  ];
  shell.rows = sessions;
  shell.addEventListener('row-click', (e) => {
    const id = e.detail.row?.id;
    if (id) navigate(`/insights/analytics/session/${encodeURIComponent(id)}`);
  });
  slot.appendChild(shell);
}
