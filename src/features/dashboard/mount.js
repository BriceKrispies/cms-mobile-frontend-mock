import { mockApi } from '../../mock-data/api/mockApi.js';
import { h, escapeHtml } from '../../utils/dom.js';
import { navigate } from '../../app/router.js';
import { appBus } from '../../utils/events.js';

const styleUrl = new URL('./dashboard.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

export async function mount({ outlet, signal }) {
  ensureStyle();

  const container = document.createElement('section');
  container.className = 'u-container dashboard';
  container.innerHTML = `
    <page-header
      eyebrow="Overview"
      title="Dashboard"
      description="Your team's recognition pulse at a glance.">
      <div slot="actions">
        <ui-button variant="ghost" id="dash-scenario">Scenario: ${escapeHtml(mockApi.getScenario())}</ui-button>
        <ui-button variant="primary" id="dash-create">Give recognition</ui-button>
      </div>
    </page-header>

    <section class="dashboard__metrics" aria-label="Key metrics">
      <ui-grid cols="4" gap="4" id="dash-metrics"></ui-grid>
    </section>

    <section class="dashboard__layout">
      <div>
        <ui-stack gap="4">
          <h2>Recent recognitions</h2>
          <div class="dashboard__recognitions" id="dash-feed"></div>
          <ui-button variant="ghost" id="dash-all">View all recognitions →</ui-button>
        </ui-stack>
      </div>

      <div>
        <ui-card>
          <span slot="title">Participation (last 4 weeks)</span>
          <div class="trend-chart" id="dash-trend"></div>
          <small class="u-text-muted">Active participants as % of headcount.</small>
        </ui-card>
      </div>
    </section>
  `;
  outlet.appendChild(container);

  const metricsEl = container.querySelector('#dash-metrics');
  const feedEl    = container.querySelector('#dash-feed');
  const trendEl   = container.querySelector('#dash-trend');
  const createBtn = container.querySelector('#dash-create');
  const allBtn    = container.querySelector('#dash-all');
  const scenarioBtn = container.querySelector('#dash-scenario');

  createBtn.addEventListener('click', () => navigate('/recognitions/new'));
  allBtn.addEventListener('click', () => navigate('/recognitions'));
  scenarioBtn.addEventListener('click', () => navigate('/settings'));

  // --- Loading states ---
  metricsEl.innerHTML = loadingGrid(4);
  feedEl.innerHTML = `<div class="dashboard__loading">Loading recognitions…</div>`;
  trendEl.innerHTML = '';

  try {
    const [metrics, trend, feed] = await Promise.all([
      mockApi.getDashboardMetrics(),
      mockApi.getParticipationTrend(),
      mockApi.listRecognitions({ limit: 5 }),
    ]);
    if (signal?.aborted) return;

    metricsEl.innerHTML = metrics.map((m) => `
      <metric-card
        label="${escapeHtml(m.label)}"
        value="${escapeHtml(m.value)}"
        delta="${escapeHtml(m.delta ?? '')}"
        tone="${escapeHtml(m.tone ?? 'flat')}"
        ${m.footnote ? `footnote="${escapeHtml(m.footnote)}"` : ''}
      ></metric-card>
    `).join('');

    renderTrend(trendEl, trend);

    if (!feed.length) {
      feedEl.innerHTML = `<div class="dashboard__empty">No recognitions yet — be the first to say thanks.</div>`;
    } else {
      feedEl.innerHTML = '';
      for (const r of feed) {
        const card = document.createElement('recognition-card');
        card.data = r;
        feedEl.appendChild(card);
      }
    }
  } catch (err) {
    feedEl.innerHTML = `<div class="dashboard__empty">Failed to load: ${escapeHtml(err.message)}</div>`;
  }

  // Refresh label when scenario changes elsewhere.
  const off = appBus.on('mock:scenario-changed', ({ scenarioId }) => {
    scenarioBtn.textContent = `Scenario: ${scenarioId}`;
  });
  signal?.addEventListener('abort', off);
}

function loadingGrid(n) {
  return Array.from({ length: n }, () => `
    <ui-card elevation="none">
      <div style="height: 14px; width: 60%; background: var(--color-surface-alt); border-radius: var(--radius-sm);"></div>
      <div style="height: 28px; width: 40%; background: var(--color-surface-alt); border-radius: var(--radius-sm); margin-top: var(--space-2);"></div>
    </ui-card>
  `).join('');
}

function renderTrend(el, trend) {
  const max = Math.max(1, ...trend.map((p) => p.value));
  el.innerHTML = trend.map((p) => `
    <div class="trend-chart__bar">
      <div class="trend-chart__column" style="--_h: ${(p.value / max) * 100}%" aria-hidden="true"></div>
      <div class="trend-chart__label">${escapeHtml(p.week)} · ${escapeHtml(p.value)}%</div>
    </div>
  `).join('');
}

