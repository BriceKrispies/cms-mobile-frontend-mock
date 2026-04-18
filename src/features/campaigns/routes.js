import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';

async function mount({ outlet }) {
  const rows = await mockApi.listCampaigns();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Programs"
      title="Campaigns"
      description="Structured recognition pushes with goals and audiences.">
      <div slot="actions">
        <ui-button variant="primary">New campaign</ui-button>
      </div>
    </page-header>

    <ui-grid cols="2" gap="4" id="camp-grid"></ui-grid>
  `;
  outlet.appendChild(wrap);

  const grid = wrap.querySelector('#camp-grid');
  const tone = { active: 'success', draft: 'warning', archived: 'info' };
  grid.innerHTML = rows.map((c) => `
    <ui-card interactive>
      <span slot="title">${escapeHtml(c.name)}</span>
      <ui-badge slot="actions" tone="${tone[c.status] ?? 'info'}">${escapeHtml(c.status)}</ui-badge>
      <div class="u-text-sm u-text-muted">${escapeHtml(c.audience)}</div>
      <div class="u-text-sm">${escapeHtml(c.startsAt)} → ${escapeHtml(c.endsAt)}</div>
      <div>
        <div class="u-text-xs u-text-muted u-mb-2">Participation</div>
        <div style="height:6px;background:var(--color-surface-alt);border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(c.participation * 100)}%;background:var(--color-primary);"></div>
        </div>
        <div class="u-text-xs u-text-muted" style="margin-top:var(--space-1)">${Math.round(c.participation * 100)}%</div>
      </div>
    </ui-card>
  `).join('') || '<p class="u-text-muted">No campaigns yet.</p>';
}

export const routes = [{ path: '/campaigns', mount }];
