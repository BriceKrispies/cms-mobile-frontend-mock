import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';
import { navigate } from '../../app/router.js';
import { appBus } from '../../utils/events.js';

const styleUrl = new URL('./groups.css', import.meta.url).href;
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

// --- List route -----------------------------------------------------------

async function mountList({ outlet, signal }) {
  ensureStyle();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Audiences"
      title="Groups"
      description="Reusable audience definitions. Combine schema fields, group references, and ANY/ALL/NONE logic to define who matches.">
      <div slot="actions">
        <ui-button variant="primary" id="groups-new">New group</ui-button>
      </div>
    </page-header>

    <data-table-shell title="All groups" id="groups-shell"></data-table-shell>
  `;
  outlet.appendChild(wrap);

  wrap.querySelector('#groups-new').addEventListener('click', () => navigate('/groups/new'));

  const shell = wrap.querySelector('#groups-shell');

  const render = () => {
    const rows = mockApi.listGroups().map((g) => {
      const result = mockApi.resolveGroup(g.id);
      return {
        ...g,
        count: result.count,
        errorCount: result.errors.length,
      };
    });
    shell.setAttribute('count', String(rows.length));
    shell.columns = [
      { key: 'name', label: 'Name', priority: 'title',
        sortable: true, filter: 'text' },
      { key: 'count', label: 'Members', priority: 'subtitle',
        sortable: true, type: 'number',
        sortValue: (g) => g.count,
        render: (g) => `${g.count} ${g.count === 1 ? 'person' : 'people'}${g.errorCount ? ` · ${g.errorCount} issue${g.errorCount === 1 ? '' : 's'}` : ''}` },
      { key: 'description', label: 'Description',
        filter: 'text',
        filterValue: (g) => g.description || '',
        render: (g) => g.description || '—' },
      { key: 'source', label: 'Source',
        sortable: true, filter: 'enum',
        filterValue: (g) => g.source === 'seed' ? 'Built-in' : 'Custom',
        sortValue: (g) => g.source === 'seed' ? 'Built-in' : 'Custom',
        render: (g) => g.source === 'seed' ? 'Built-in' : 'Custom' },
    ];
    shell.rows = rows;
  };

  render();

  const off = [
    appBus.on('groups:change', render),
    appBus.on('schema:change', render),
    appBus.on('mock:scenario-changed', render),
  ];
  signal?.addEventListener('abort', () => off.forEach((fn) => fn()));

  const onRowClick = (e) => {
    const row = e.detail?.row;
    if (row?.id) navigate(`/groups/${row.id}`);
  };
  shell.addEventListener('row-click', onRowClick);
  signal?.addEventListener('abort', () => shell.removeEventListener('row-click', onRowClick));
}

// --- Shared form (new + edit) ---------------------------------------------

function renderForm({ container, group, isNew, onSave, onDelete, onCancel, signal }) {
  const applied = group
    ? {
        id: group.id,
        name: group.name ?? '',
        description: group.description ?? '',
        definition: structuredClone(group.definition),
      }
    : { id: '', name: '', description: '', definition: { kind: 'and', children: [] } };

  let pending = structuredClone(applied);

  const isSeed = group?.source === 'seed';
  const idEditable = isNew;
  const definitionEditable = isNew || !isSeed;

  const isDirty = () => {
    if (pending.id !== applied.id) return true;
    if (pending.name !== applied.name) return true;
    if ((pending.description ?? '') !== (applied.description ?? '')) return true;
    if (JSON.stringify(pending.definition) !== JSON.stringify(applied.definition)) return true;
    return false;
  };

  const validate = () => {
    const errs = {};
    if (!pending.id || !ID_RE.test(pending.id)) {
      errs.id = 'Lowercase letters, digits, underscore. Must start with a letter.';
    } else if (isNew && mockApi.getGroup(pending.id)) {
      errs.id = `A group with id "${pending.id}" already exists.`;
    }
    if (!pending.name.trim()) errs.name = 'Required.';
    const defErrs = mockApi.validateGroupDefinition(pending.definition, { ownerId: pending.id });
    if (defErrs.length) errs.definition = defErrs;
    return errs;
  };

  const draw = () => {
    const errs = validate();
    const dirty = isDirty();
    const canSave = dirty && !errs.id && !errs.name && !errs.definition;

    container.innerHTML = `
      <ui-card>
        <span slot="title">${isNew ? 'New group' : escapeHtml(applied.name)}</span>
        ${!isNew ? `<ui-badge slot="actions" tone="${isSeed ? 'info' : 'primary'}">${isSeed ? 'Built-in' : 'Custom'}</ui-badge>` : ''}

        <div class="groups-form">
          <div class="groups-form__row groups-form__row--two">
            <ui-input
              label="Id"
              placeholder="e.g. eng_managers"
              value="${escapeHtml(pending.id)}"
              id="g-id"
              ${idEditable ? '' : 'disabled'}
              hint="${idEditable ? 'Immutable after save. Letters, digits, underscore — must start with a lowercase letter.' : 'Id cannot be changed.'}"
              ${errs.id ? `error="${escapeHtml(errs.id)}" invalid` : ''}></ui-input>

            <ui-input
              label="Name"
              placeholder="Display name"
              value="${escapeHtml(pending.name)}"
              id="g-name"
              ${errs.name ? `error="${escapeHtml(errs.name)}" invalid` : ''}></ui-input>
          </div>

          <ui-input
            label="Description"
            placeholder="What this group represents."
            value="${escapeHtml(pending.description)}"
            id="g-desc"></ui-input>

          <div>
            <div class="u-text-sm u-text-muted u-mb-2">Definition</div>
            ${definitionEditable
              ? '<div id="g-builder-slot"></div>'
              : '<div class="groups-form__readonly">This is a built-in group. Its definition cannot be changed — fork it by creating a new group.</div>'}
          </div>

          ${errs.definition ? `
            <div class="groups-form__errors">
              <strong>Definition errors:</strong>
              <ul>${errs.definition.map((e) => `<li><code>${escapeHtml(e.path)}</code> — ${escapeHtml(e.message)}</li>`).join('')}</ul>
            </div>
          ` : ''}

          <div class="groups-form__preview" id="g-preview"></div>
        </div>

        <div slot="footer" class="settings-footer" data-dirty="${dirty}">
          <span class="settings-footer__status">
            ${dirty
              ? (canSave ? 'You have unsaved changes.' : 'Fix the errors above to save.')
              : (isNew ? 'No changes yet.' : 'All changes saved.')}
          </span>
          <ui-stack direction="row" gap="2" justify="end">
            <ui-button id="g-cancel" variant="ghost">${dirty ? 'Discard' : 'Back'}</ui-button>
            <ui-button id="g-save" variant="primary" ${canSave ? '' : 'disabled'}>
              ${isNew ? 'Create group' : 'Save changes'}
            </ui-button>
          </ui-stack>
        </div>
      </ui-card>

      ${(!isNew && !isSeed) ? `
        <div class="schema-danger" style="margin-top: var(--space-4)">
          <strong>Delete this group</strong>
          <span class="u-text-sm u-text-muted">Deleting is permanent for this browser. Anywhere this group is referenced will start showing it as missing.</span>
          <div><ui-button id="g-delete" variant="danger" size="sm">Delete group</ui-button></div>
        </div>
      ` : ''}
    `;

    container.querySelector('#g-id')?.addEventListener('input', (e) => {
      pending.id = (e.detail?.value ?? '').trim();
      draw();
    });
    container.querySelector('#g-name').addEventListener('input', (e) => {
      pending.name = e.detail?.value ?? '';
      draw();
    });
    container.querySelector('#g-desc').addEventListener('input', (e) => {
      pending.description = e.detail?.value ?? '';
      draw();
    });

    if (definitionEditable) {
      const slot = container.querySelector('#g-builder-slot');
      const builder = document.createElement('group-builder');
      builder.ownerId = pending.id || null;
      builder.definition = pending.definition;
      builder.addEventListener('change', (e) => {
        pending.definition = e.detail.definition;
        draw();
      });
      slot.appendChild(builder);
    }

    renderPreview(container.querySelector('#g-preview'), pending);

    container.querySelector('#g-cancel').addEventListener('click', () => {
      if (dirty) {
        pending = structuredClone(applied);
        draw();
      } else {
        onCancel();
      }
    });
    container.querySelector('#g-save').addEventListener('click', () => {
      if (!canSave) return;
      onSave(pending);
    });
    container.querySelector('#g-delete')?.addEventListener('click', () => {
      if (!confirm(`Delete group "${applied.name}"? This cannot be undone.`)) return;
      onDelete();
    });
  };

  draw();

  // External changes shouldn't stomp the user's draft, but if their
  // group is changed from elsewhere, refresh applied so dirty stays accurate.
  const off = appBus.on('groups:change', (e) => {
    if (!isNew && e.id === applied.id) {
      const latest = mockApi.getGroup(applied.id);
      if (latest) {
        applied.name = latest.name;
        applied.description = latest.description;
        applied.definition = structuredClone(latest.definition);
        draw();
      }
    }
  });
  signal?.addEventListener('abort', off);
}

// Debounced live preview of pending definition.
let previewTimer = null;
function renderPreview(target, pending) {
  if (!target) return;
  clearTimeout(previewTimer);
  target.innerHTML = '<span class="u-text-muted u-text-sm">Resolving…</span>';
  previewTimer = setTimeout(() => {
    let result;
    try {
      result = mockApi.previewDefinition(pending.definition, { ownerId: pending.id });
    } catch (err) {
      target.innerHTML = `<span class="groups-form__preview-err">${escapeHtml(err.message)}</span>`;
      return;
    }
    const sample = result.users.slice(0, 5);
    target.innerHTML = `
      <div class="groups-preview">
        <div class="groups-preview__head">
          <strong>${result.count}</strong>
          <span>${result.count === 1 ? 'person matches' : 'people match'}</span>
          ${result.errors.length ? `<ui-badge tone="warning" size="sm">${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}</ui-badge>` : ''}
        </div>
        ${sample.length ? `
          <div class="groups-preview__sample">
            ${sample.map((u) => `<span class="groups-preview__chip">${escapeHtml(u.name || u.id)}</span>`).join('')}
            ${result.count > sample.length ? `<span class="groups-preview__more">+${result.count - sample.length} more</span>` : ''}
          </div>
        ` : '<div class="groups-preview__empty">No one matches yet.</div>'}
        ${result.errors.length ? `
          <ul class="groups-preview__errors">
            ${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }, 150);
}

// --- New route ------------------------------------------------------------

async function mountNew({ outlet, signal }) {
  ensureStyle();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Audiences"
      title="New group"
      description="Compose rules and existing groups into a reusable audience."></page-header>
    <div id="form-slot"></div>
  `;
  outlet.appendChild(wrap);

  renderForm({
    container: wrap.querySelector('#form-slot'),
    group: null,
    isNew: true,
    signal,
    onCancel: () => navigate('/groups'),
    onSave: (pending) => {
      try {
        mockApi.createGroup({
          id: pending.id,
          name: pending.name,
          description: pending.description,
          definition: pending.definition,
        });
        navigate(`/groups/${pending.id}`);
      } catch (err) {
        alert(`Could not save: ${err.message}`);
      }
    },
    onDelete: () => {},
  });
}

// --- View / edit route ----------------------------------------------------

async function mountEdit({ outlet, params, signal }) {
  ensureStyle();

  const group = mockApi.getGroup(params.id);
  const wrap = document.createElement('section');
  wrap.className = 'u-container';

  if (!group) {
    wrap.innerHTML = `
      <page-header eyebrow="Audiences" title="Group not found"></page-header>
      <ui-card>
        <p class="u-text-muted">No group exists with id <code>${escapeHtml(params.id)}</code>.</p>
        <ui-button variant="primary" id="back">Back to groups</ui-button>
      </ui-card>
    `;
    outlet.appendChild(wrap);
    wrap.querySelector('#back').addEventListener('click', () => navigate('/groups'));
    return;
  }

  wrap.innerHTML = `
    <page-header
      eyebrow="${escapeHtml(group.source === 'seed' ? 'Built-in group' : 'Custom group')}"
      title="${escapeHtml(group.name)}"
      description="${escapeHtml(group.description || 'No description.')}"></page-header>
    <div id="form-slot"></div>
  `;
  outlet.appendChild(wrap);

  renderForm({
    container: wrap.querySelector('#form-slot'),
    group,
    isNew: false,
    signal,
    onCancel: () => navigate('/groups'),
    onSave: (pending) => {
      try {
        const patch = {
          name: pending.name,
          description: pending.description,
        };
        if (group.source !== 'seed') patch.definition = pending.definition;
        mockApi.updateGroup(group.id, patch);
      } catch (err) {
        alert(`Could not save: ${err.message}`);
      }
    },
    onDelete: () => {
      try {
        mockApi.deleteGroup(group.id);
        navigate('/groups');
      } catch (err) {
        alert(`Could not delete: ${err.message}`);
      }
    },
  });
}

export const routes = [
  { path: '/groups',     mount: mountList },
  { path: '/groups/new', mount: mountNew },
  { path: '/groups/:id', mount: mountEdit },
];
