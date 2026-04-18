import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';

async function mount({ outlet }) {
  const [metrics, trend] = await Promise.all([
    mockApi.getDashboardMetrics(),
    mockApi.getParticipationTrend(),
  ]);

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Insights"
      title="Reporting"
      description="Track adoption, participation, and impact over time."></page-header>

    <ui-grid cols="4" gap="4" id="rep-metrics"></ui-grid>

    <div style="margin-top: var(--space-6)">
      <ui-card>
        <span slot="title">Participation by week</span>
        <table style="width:100%; border-collapse: collapse;">
          <thead><tr>
            <th style="text-align:left;padding:var(--space-2);color:var(--color-text-muted);font-size:var(--font-size-xs);text-transform:uppercase">Week</th>
            <th style="text-align:right;padding:var(--space-2);color:var(--color-text-muted);font-size:var(--font-size-xs);text-transform:uppercase">Participation</th>
          </tr></thead>
          <tbody>
            ${trend.map((t) => `<tr>
              <td style="padding:var(--space-2);border-top:1px solid var(--color-border);">${escapeHtml(t.week)}</td>
              <td style="padding:var(--space-2);border-top:1px solid var(--color-border);text-align:right;">${escapeHtml(t.value)}%</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </ui-card>
    </div>
  `;
  outlet.appendChild(wrap);

  wrap.querySelector('#rep-metrics').innerHTML = metrics.map((m) => `
    <metric-card label="${escapeHtml(m.label)}" value="${escapeHtml(m.value)}" delta="${escapeHtml(m.delta ?? '')}" tone="${escapeHtml(m.tone ?? 'flat')}"></metric-card>
  `).join('');
}

export const routes = [{ path: '/reporting', mount }];
