import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';
import { navigate } from '../../app/router.js';
import { appBus } from '../../utils/events.js';

const styleUrl = new URL('./campaigns.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

const ID_RE = /^[a-z][a-zA-Z0-9_]*$/;
const TONE = { active: 'success', draft: 'warning', archived: 'info' };

// --- List ------------------------------------------------------------------

async function mountList({ outlet, signal }) {
  ensureStyle();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Programs"
      title="Campaigns"
      description="Structured recognition pushes with goals and audiences.">
      <div slot="actions">
        <ui-button variant="primary" id="camp-new">New campaign</ui-button>
      </div>
    </page-header>

    <ui-grid cols="2" gap="4" id="camp-grid"></ui-grid>
  `;
  outlet.appendChild(wrap);

  wrap.querySelector('#camp-new').addEventListener('click', () => navigate('/campaigns/new'));

  const grid = wrap.querySelector('#camp-grid');

  const render = async () => {
    const rows = await mockApi.listCampaigns();
    grid.innerHTML = rows.length ? rows.map((c) => cardHtml(c)).join('') : '<p class="u-text-muted">No campaigns yet.</p>';
    grid.querySelectorAll('[data-campaign]').forEach((el) => {
      el.addEventListener('click', () => navigate(`/campaigns/${el.dataset.campaign}`));
    });
  };

  await render();

  const off = [
    appBus.on('campaigns:change', render),
    appBus.on('groups:change', render),
    appBus.on('mock:scenario-changed', render),
  ];
  signal?.addEventListener('abort', () => off.forEach((fn) => fn()));
}

function cardHtml(c) {
  const g = c.audienceGroup;
  const badgeTone = g.source === 'group-missing' ? 'danger'
    : g.source === 'adhoc' ? 'warning'
    : g.source === 'legacy' ? 'info'
    : 'primary';
  const badgeLabel = g.source === 'adhoc' ? 'Custom'
    : g.source === 'group-missing' ? 'Missing group'
    : g.source === 'legacy' ? 'Legacy label'
    : 'Group';
  return `
    <ui-card interactive data-campaign="${escapeHtml(c.id)}">
      <span slot="title">${escapeHtml(c.name)}</span>
      <ui-badge slot="actions" tone="${TONE[c.status] ?? 'info'}">${escapeHtml(c.status)}</ui-badge>

      <div class="camp-audience">
        <div class="camp-audience__label">
          <ui-badge tone="${badgeTone}" size="sm">${badgeLabel}</ui-badge>
          <strong>${escapeHtml(g.name)}</strong>
        </div>
        <div class="camp-audience__count">
          ${g.count} ${g.count === 1 ? 'person' : 'people'}
          ${g.errors.length ? ` · <span class="camp-audience__err">${g.errors.length} issue${g.errors.length === 1 ? '' : 's'}</span>` : ''}
        </div>
      </div>

      <div class="u-text-sm u-text-muted">${escapeHtml(c.startsAt)} → ${escapeHtml(c.endsAt)}</div>
      <div>
        <div class="u-text-xs u-text-muted u-mb-2">Participation</div>
        <div class="camp-bar"><div class="camp-bar__fill" style="width:${Math.round(c.participation * 100)}%"></div></div>
        <div class="u-text-xs u-text-muted" style="margin-top:var(--space-1)">${Math.round(c.participation * 100)}%</div>
      </div>
    </ui-card>
  `;
}

// --- Detail (read-only for now) -------------------------------------------

async function mountDetail({ outlet, params, signal }) {
  ensureStyle();
  const campaign = await mockApi.getCampaign(params.id);
  const wrap = document.createElement('section');
  wrap.className = 'u-container';

  if (!campaign) {
    wrap.innerHTML = `
      <page-header eyebrow="Programs" title="Campaign not found"></page-header>
      <ui-card>
        <p class="u-text-muted">No campaign with id <code>${escapeHtml(params.id)}</code>.</p>
        <ui-button variant="primary" id="back">Back to campaigns</ui-button>
      </ui-card>
    `;
    outlet.appendChild(wrap);
    wrap.querySelector('#back').addEventListener('click', () => navigate('/campaigns'));
    return;
  }

  const g = campaign.audienceGroup;
  wrap.innerHTML = `
    <page-header
      eyebrow="Campaign"
      title="${escapeHtml(campaign.name)}"
      description="${escapeHtml(campaign.startsAt)} → ${escapeHtml(campaign.endsAt)}">
      <div slot="actions">
        <ui-badge tone="${TONE[campaign.status] ?? 'info'}">${escapeHtml(campaign.status)}</ui-badge>
      </div>
    </page-header>

    <ui-card>
      <span slot="title">Audience</span>
      ${g.id ? `<group-summary group-id="${escapeHtml(g.id)}"></group-summary>` : `
        <div class="camp-audience camp-audience--block">
          <div class="camp-audience__label">
            <ui-badge tone="${g.source === 'adhoc' ? 'warning' : 'info'}" size="sm">${g.source === 'adhoc' ? 'Custom' : 'Legacy'}</ui-badge>
            <strong>${escapeHtml(g.name)}</strong>
          </div>
          <div class="camp-audience__count">
            ${g.count} ${g.count === 1 ? 'person' : 'people'}
            ${g.errors.length ? ` · <span class="camp-audience__err">${g.errors.length} issue${g.errors.length === 1 ? '' : 's'}</span>` : ''}
          </div>
        </div>
      `}
    </ui-card>

    <ui-stack direction="row" gap="2" style="margin-top: var(--space-4)">
      <ui-button id="back" variant="ghost">Back</ui-button>
    </ui-stack>
  `;
  outlet.appendChild(wrap);
  wrap.querySelector('#back').addEventListener('click', () => navigate('/campaigns'));
}

// --- New (stage-and-save) --------------------------------------------------

async function mountNew({ outlet, signal }) {
  ensureStyle();

  const applied = { id: '', name: '', status: 'draft', startsAt: '', endsAt: '', audience: { groupId: null } };
  let pending = structuredClone(applied);

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Programs"
      title="New campaign"
      description="Give the campaign a name, a window, and an audience."></page-header>
    <div id="form-slot"></div>
  `;
  outlet.appendChild(wrap);

  const slot = wrap.querySelector('#form-slot');

  const isDirty = () => JSON.stringify(pending) !== JSON.stringify(applied);
  const validate = () => {
    const errs = {};
    if (!pending.id || !ID_RE.test(pending.id)) errs.id = 'Lowercase letters, digits, underscore. Must start with a letter.';
    if (!pending.name.trim()) errs.name = 'Required.';
    if (!pending.startsAt) errs.startsAt = 'Required.';
    if (!pending.endsAt) errs.endsAt = 'Required.';
    if (pending.startsAt && pending.endsAt && pending.endsAt < pending.startsAt) errs.range = 'End must be after start.';
    if (!pending.audience.groupId && !pending.audience.definition) errs.audience = 'Pick or build an audience.';
    return errs;
  };

  const draw = () => {
    const errs = validate();
    const dirty = isDirty();
    const canSave = dirty && !Object.keys(errs).length;

    slot.innerHTML = `
      <ui-card>
        <span slot="title">New campaign</span>

        <div class="camp-form">
          <div class="camp-form__row camp-form__row--two">
            <ui-input label="Id" placeholder="e.g. summer_kickoff" value="${escapeHtml(pending.id)}" id="f-id" ${errs.id ? `error="${escapeHtml(errs.id)}" invalid` : ''}></ui-input>
            <ui-input label="Name" placeholder="Display name" value="${escapeHtml(pending.name)}" id="f-name" ${errs.name ? `error="${escapeHtml(errs.name)}" invalid` : ''}></ui-input>
          </div>

          <div class="camp-form__row camp-form__row--two">
            <ui-input label="Starts" type="date" value="${escapeHtml(pending.startsAt)}" id="f-starts" ${errs.startsAt ? `error="${escapeHtml(errs.startsAt)}" invalid` : ''}></ui-input>
            <ui-input label="Ends" type="date" value="${escapeHtml(pending.endsAt)}" id="f-ends" ${errs.endsAt || errs.range ? `error="${escapeHtml(errs.endsAt || errs.range)}" invalid` : ''}></ui-input>
          </div>

          <div>
            <div class="u-text-sm u-text-muted u-mb-2">Status</div>
            <div class="camp-form__status">
              ${['draft', 'active', 'archived'].map((s) => `
                <ui-button size="sm" variant="${s === pending.status ? 'primary' : 'subtle'}" data-status="${s}">${s}</ui-button>
              `).join('')}
            </div>
          </div>

          <div>
            <div class="u-text-sm u-text-muted u-mb-2">Audience</div>
            <div id="audience-slot"></div>
            ${errs.audience ? `<p class="camp-form__err">${escapeHtml(errs.audience)}</p>` : ''}
          </div>
        </div>

        <div slot="footer" class="settings-footer" data-dirty="${dirty}">
          <span class="settings-footer__status">
            ${dirty ? (canSave ? 'You have unsaved changes.' : 'Fix the errors above to save.') : 'No changes yet.'}
          </span>
          <ui-stack direction="row" gap="2" justify="end">
            <ui-button id="f-cancel" variant="ghost">${dirty ? 'Discard' : 'Back'}</ui-button>
            <ui-button id="f-save" variant="primary" ${canSave ? '' : 'disabled'}>Create campaign</ui-button>
          </ui-stack>
        </div>
      </ui-card>
    `;

    slot.querySelector('#f-id').addEventListener('input', (e) => { pending.id = (e.detail?.value ?? '').trim(); draw(); });
    slot.querySelector('#f-name').addEventListener('input', (e) => { pending.name = e.detail?.value ?? ''; draw(); });
    slot.querySelector('#f-starts').addEventListener('input', (e) => { pending.startsAt = e.detail?.value ?? ''; draw(); });
    slot.querySelector('#f-ends').addEventListener('input', (e) => { pending.endsAt = e.detail?.value ?? ''; draw(); });

    slot.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', () => { pending.status = btn.dataset.status; draw(); });
    });

    const picker = document.createElement('group-picker');
    picker.value = pending.audience;
    picker.addEventListener('change', (e) => {
      pending.audience = e.detail.value;
      draw();
    });
    slot.querySelector('#audience-slot').appendChild(picker);

    slot.querySelector('#f-cancel').addEventListener('click', () => {
      if (dirty) { pending = structuredClone(applied); draw(); }
      else navigate('/campaigns');
    });
    slot.querySelector('#f-save').addEventListener('click', () => {
      if (!canSave) return;
      try {
        mockApi.createCampaign({
          id: pending.id,
          name: pending.name,
          status: pending.status,
          startsAt: pending.startsAt,
          endsAt: pending.endsAt,
          audienceGroupId: pending.audience.groupId ?? null,
          audienceDefinition: pending.audience.definition ?? null,
          audience: '',
          participation: 0,
        });
        navigate(`/campaigns/${pending.id}`);
      } catch (err) {
        alert(`Could not save: ${err.message}`);
      }
    });
  };

  draw();
}

export const routes = [
  { path: '/campaigns',       mount: mountList },
  { path: '/campaigns/new',   mount: mountNew },
  { path: '/campaigns/:id',   mount: mountDetail },
];
