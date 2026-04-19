// /insights/reporting — ported from the old /reporting page, slightly
// expanded with a "top teams" breakdown so it's meaningfully distinct
// from the dashboard's metric strip.

import { mockApi } from '../../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../../utils/dom.js';
import { appBus } from '../../../utils/events.js';
import { ensureInsightsStyle, tabStripHtml, renderTrend } from './chrome.js';

export async function mountReporting({ outlet, signal }) {
  ensureInsightsStyle();

  const wrap = document.createElement('section');
  wrap.className = 'u-container insights';
  wrap.innerHTML = `
    <page-header
      eyebrow="Insights"
      title="Reporting"
      description="Track adoption, participation, and impact over time."></page-header>

    ${tabStripHtml('reporting')}

    <ui-grid cols="4" gap="4" id="rep-metrics"></ui-grid>

    <div class="insights-stats">
      <ui-card>
        <span slot="title">Participation (last 4 weeks)</span>
        <div class="insights-trend" id="rep-trend"></div>
        <small class="u-text-muted">Active participants as % of headcount.</small>
      </ui-card>

      <ui-card>
        <span slot="title">Top teams by recognitions</span>
        <div id="rep-teams"></div>
      </ui-card>
    </div>
  `;
  outlet.appendChild(wrap);

  const metricsEl = wrap.querySelector('#rep-metrics');
  const trendEl = wrap.querySelector('#rep-trend');
  const teamsEl = wrap.querySelector('#rep-teams');

  const draw = async () => {
    try {
      const [metrics, trend, recognitions] = await Promise.all([
        mockApi.getDashboardMetrics(),
        mockApi.getParticipationTrend(),
        mockApi.listRecognitions({ limit: 500 }),
      ]);
      if (signal?.aborted) return;

      metricsEl.innerHTML = metrics.map((m) => `
        <metric-card
          label="${escapeHtml(m.label)}"
          value="${escapeHtml(m.value)}"
          delta="${escapeHtml(m.delta ?? '')}"
          tone="${escapeHtml(m.tone ?? 'flat')}"
          ${m.footnote ? `footnote="${escapeHtml(m.footnote)}"` : ''}></metric-card>
      `).join('');

      renderTrend(trendEl, trend, {
        labelOf: (d) => `${d.week} · ${d.value}%`,
        valueOf: (d) => d.value,
      });

      renderTeamsRanking(teamsEl, recognitions);
    } catch (err) {
      metricsEl.innerHTML = `<div class="insights-empty">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  };

  draw();

  const off = appBus.on('mock:scenario-changed', draw);
  signal?.addEventListener('abort', off);
}

function renderTeamsRanking(el, recognitions) {
  if (!recognitions.length) {
    el.innerHTML = `<div class="insights-empty">No recognitions yet.</div>`;
    return;
  }
  const counts = new Map();
  for (const r of recognitions) {
    const team = r.to?.team || 'Unassigned';
    counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const max = Math.max(1, ...ranked.map((r) => r.count));
  el.innerHTML = `
    <div class="insights-rank">
      ${ranked.map((r, i) => `
        <div class="insights-rank__row">
          <span class="insights-rank__index">${i + 1}</span>
          <span class="insights-rank__label">${escapeHtml(r.team)}</span>
          <span class="insights-rank__meta">${r.count}</span>
          <span class="insights-rank__bar" style="--_w: ${(r.count / max) * 100}%"></span>
        </div>
      `).join('')}
    </div>
  `;
}
