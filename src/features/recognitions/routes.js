import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';
import { navigate } from '../../app/router.js';

async function renderList({ outlet, signal }) {
  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Feed"
      title="Recognitions"
      description="Every kind word your team has shared.">
      <div slot="actions">
        <ui-button variant="primary" data-action="new">Give recognition</ui-button>
      </div>
    </page-header>

    <filter-bar placeholder="Search recognitions…" id="rec-filter"></filter-bar>
    <ui-stack gap="4" style="margin-top: var(--space-4)">
      <div id="rec-list"></div>
    </ui-stack>
  `;
  outlet.appendChild(wrap);

  const filter = wrap.querySelector('#rec-filter');
  const list = wrap.querySelector('#rec-list');

  filter.chips = [
    { id: 'all',       label: 'All' },
    { id: 'approved',  label: 'Approved' },
    { id: 'pending',   label: 'Pending' },
  ];
  filter.active = 'all';

  wrap.querySelector('[data-action="new"]').addEventListener('click', () => navigate('/recognitions/new'));

  let current = { search: '', active: 'all' };
  const load = async () => {
    list.innerHTML = '<div class="u-text-muted" style="padding: var(--space-4)">Loading…</div>';
    const status = current.active === 'all' ? undefined : current.active;
    const rows = await mockApi.listRecognitions({ status, search: current.search });
    if (signal?.aborted) return;
    if (!rows.length) {
      list.innerHTML = `<ui-card><p class="u-text-muted">No recognitions match your filters.</p></ui-card>`;
      return;
    }
    list.innerHTML = '';
    const stack = document.createElement('ui-stack');
    stack.setAttribute('gap', '3');
    for (const r of rows) {
      const card = document.createElement('recognition-card');
      card.data = r;
      stack.appendChild(card);
    }
    list.appendChild(stack);
  };

  filter.addEventListener('filter-change', (e) => {
    current = e.detail;
    load();
  });

  await load();
}

async function renderNew({ outlet }) {
  const values = await mockApi.listValues();
  const people = await mockApi.listPeople();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header eyebrow="New" title="Give recognition" description="Send a note that will be visible to your team."></page-header>

    <ui-card>
      <ui-stack gap="4">
        <ui-input label="Recipient" placeholder="Search people…" id="rec-to"></ui-input>
        <ui-input label="Message" placeholder="What did they do well?" id="rec-msg"></ui-input>
        <div>
          <div class="u-text-sm u-text-muted u-mb-2">Values</div>
          <div style="display:flex; flex-wrap:wrap; gap: var(--space-2)" id="rec-values">
            ${values.map((v) => `<button type="button" class="chip" data-value="${escapeHtml(v.label)}" aria-pressed="false" style="padding:4px 12px;border-radius:999px;background:var(--color-surface-alt);color:var(--color-text-muted);border:0;cursor:pointer;">${escapeHtml(v.label)}</button>`).join('')}
          </div>
        </div>
        <ui-stack direction="row" gap="2" justify="end">
          <ui-button variant="ghost" id="rec-cancel">Cancel</ui-button>
          <ui-button variant="primary" id="rec-submit">Send recognition</ui-button>
        </ui-stack>
      </ui-stack>

      <small slot="footer" class="u-text-muted">(Mock form — not wired to persistence.) ${people.length} teammates available.</small>
    </ui-card>
  `;
  outlet.appendChild(wrap);

  wrap.querySelectorAll('#rec-values .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const pressed = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!pressed));
      chip.style.background = !pressed ? 'var(--color-primary-soft)' : 'var(--color-surface-alt)';
      chip.style.color = !pressed ? 'var(--color-primary)' : 'var(--color-text-muted)';
    });
  });

  wrap.querySelector('#rec-cancel').addEventListener('click', () => navigate('/recognitions'));
  wrap.querySelector('#rec-submit').addEventListener('click', () => {
    alert('Mock: recognition submitted.');
    navigate('/recognitions');
  });
}

export const routes = [
  { path: '/recognitions',     mount: renderList },
  { path: '/recognitions/new', mount: renderNew },
];
