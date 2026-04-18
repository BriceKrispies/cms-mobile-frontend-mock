import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';

async function mount({ outlet }) {
  const rows = await mockApi.listRewards();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Catalog"
      title="Rewards"
      description="What recipients can redeem their points for."></page-header>

    <ui-grid cols="3" gap="4" id="reward-grid"></ui-grid>
  `;
  outlet.appendChild(wrap);

  wrap.querySelector('#reward-grid').innerHTML = rows.map((r) => `
    <ui-card interactive>
      <span slot="title">${escapeHtml(r.name)}</span>
      <ui-badge slot="actions" tone="primary">${escapeHtml(r.cost)} pts</ui-badge>
      <div class="u-text-sm u-text-muted">${escapeHtml(r.category)}</div>
      <div class="u-text-xs u-text-subtle">In stock: ${escapeHtml(r.stock)}</div>
    </ui-card>
  `).join('');
}

export const routes = [{ path: '/rewards', mount }];
