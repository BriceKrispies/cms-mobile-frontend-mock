import { mockApi } from '../../mock-data/api/mockApi.js';
import { TYPE_IDS, TYPES } from '../../schema/index.js';
import { escapeHtml } from '../../utils/dom.js';
import { navigate } from '../../app/router.js';
import { appBus } from '../../utils/events.js';

const styleUrl = new URL('./schema.css', import.meta.url).href;
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
      eyebrow="Admin"
      title="User schema"
      description="Declare the fields every user document may populate. Adding a field here makes it immediately available in the People table and any future audience builder.">
      <div slot="actions">
        <ui-button variant="primary" id="schema-new">New field</ui-button>
      </div>
    </page-header>

    <data-table-shell title="Fields" id="schema-shell"></data-table-shell>
  `;
  outlet.appendChild(wrap);

  wrap.querySelector('#schema-new').addEventListener('click', () => navigate('/schema/new'));

  const shell = wrap.querySelector('#schema-shell');

  const render = () => {
    const fields = mockApi.listFields();
    shell.setAttribute('count', String(fields.length));
    shell.columns = [
      { key: 'id',     label: 'Id' },
      { key: 'label',  label: 'Label' },
      { key: 'type',   label: 'Type',   render: (f) => TYPES[f.type]?.label ?? f.type },
      { key: 'source', label: 'Source', render: (f) => f.source === 'seed' ? 'Built-in' : 'Custom' },
      {
        key: 'constraints',
        label: 'Constraints',
        render: (f) => {
          if (f.type === 'string' && f.enumValues?.length) {
            return `${f.enumValues.length} value${f.enumValues.length === 1 ? '' : 's'}`;
          }
          if (f.type === 'number') {
            const parts = [];
            if (f.min != null) parts.push(`≥ ${f.min}`);
            if (f.max != null) parts.push(`≤ ${f.max}`);
            return parts.join(', ') || '—';
          }
          return '—';
        },
      },
    ];
    shell.rows = fields;
  };

  render();

  // Re-render if schema changes from elsewhere.
  const off = appBus.on('schema:change', render);
  signal?.addEventListener('abort', off);

  // Rows live inside ui-table's shadow DOM, so listen on the shell and
  // walk composedPath() to find the original <tr> the user clicked.
  const delegate = (e) => {
    const tr = e.composedPath().find((el) => el && el.tagName === 'TR');
    if (!tr) return;
    const firstTd = tr.querySelector('td');
    const id = firstTd?.textContent?.trim();
    if (id) navigate(`/schema/${id}`);
  };
  shell.addEventListener('click', delegate);
  signal?.addEventListener('abort', () => shell.removeEventListener('click', delegate));
}

// --- Shared form rendering (used by both new and edit) --------------------

function renderForm({ container, field, isNew, onSave, onCancel, onDelete, signal }) {
  // pending = the draft the user is editing
  // applied = the last-persisted version we diff against for dirty state
  const applied = field
    ? {
        id: field.id,
        label: field.label ?? '',
        type: field.type ?? 'string',
        description: field.description ?? '',
        enumValues: [...(field.enumValues ?? [])],
        min: field.min ?? null,
        max: field.max ?? null,
      }
    : { id: '', label: '', type: 'string', description: '', enumValues: [], min: null, max: null };

  let pending = { ...applied, enumValues: [...applied.enumValues] };

  const isSeed = field?.source === 'seed';
  const idEditable = isNew;
  const typeEditable = isNew;

  const isDirty = () => {
    if (pending.id !== applied.id) return true;
    if (pending.label !== applied.label) return true;
    if (pending.type !== applied.type) return true;
    if ((pending.description ?? '') !== (applied.description ?? '')) return true;
    if (JSON.stringify(pending.enumValues) !== JSON.stringify(applied.enumValues)) return true;
    if ((pending.min ?? null) !== (applied.min ?? null)) return true;
    if ((pending.max ?? null) !== (applied.max ?? null)) return true;
    return false;
  };

  const validate = () => {
    const errs = {};
    if (!pending.id || !ID_RE.test(pending.id)) {
      errs.id = 'Lowercase letters, digits, underscore. Must start with a letter.';
    } else if (isNew && mockApi.getField(pending.id)) {
      errs.id = `A field named "${pending.id}" already exists.`;
    }
    if (!pending.label.trim()) errs.label = 'Required.';
    if (!TYPE_IDS.includes(pending.type)) errs.type = 'Pick a type.';
    if (pending.type === 'number' && pending.min != null && pending.max != null && pending.min > pending.max) {
      errs.range = 'Min must be ≤ max.';
    }
    return errs;
  };

  const draw = () => {
    const errs = validate();
    const dirty = isDirty();
    const canSave = dirty && !Object.keys(errs).length;

    container.innerHTML = `
      <ui-card>
        <span slot="title">${isNew ? 'New field' : escapeHtml(applied.id)}</span>
        ${!isNew ? `<ui-badge slot="actions" tone="${isSeed ? 'info' : 'primary'}">${isSeed ? 'Built-in' : 'Custom'}</ui-badge>` : ''}

        <div class="schema-form">
          <div class="schema-form__row schema-form__row--two">
            <ui-input
              label="Id"
              placeholder="e.g. slackHandle"
              value="${escapeHtml(pending.id)}"
              id="f-id"
              ${idEditable ? '' : 'disabled'}
              hint="${idEditable ? 'Immutable after save. Letters, digits, underscore — must start with a lowercase letter.' : 'Id cannot be changed.'}"
              ${errs.id ? `error="${escapeHtml(errs.id)}" invalid` : ''}></ui-input>

            <ui-input
              label="Label"
              placeholder="Human-readable name"
              value="${escapeHtml(pending.label)}"
              id="f-label"
              ${errs.label ? `error="${escapeHtml(errs.label)}" invalid` : ''}></ui-input>
          </div>

          <div>
            <div class="u-text-sm u-text-muted u-mb-2">Type</div>
            <div class="schema-form__type" id="f-type">
              ${TYPE_IDS.map((t) => `
                <ui-button
                  size="sm"
                  variant="${t === pending.type ? 'primary' : 'subtle'}"
                  data-type="${escapeHtml(t)}"
                  ${typeEditable ? '' : 'disabled'}>
                  ${escapeHtml(TYPES[t].label)}
                </ui-button>
              `).join('')}
            </div>
            <p class="schema-form__hint">${typeEditable ? 'Immutable after save — delete and recreate to change type.' : 'Type cannot be changed.'}</p>
          </div>

          <ui-input
            label="Description"
            placeholder="What this field represents (shown in tooltips)."
            value="${escapeHtml(pending.description)}"
            id="f-desc"></ui-input>

          ${pending.type === 'string' ? renderEnumEditor(pending.enumValues) : ''}

          ${pending.type === 'number' ? `
            <div class="schema-form__row schema-form__row--two">
              <ui-input label="Min (optional)" type="number" value="${pending.min ?? ''}" id="f-min"></ui-input>
              <ui-input label="Max (optional)" type="number" value="${pending.max ?? ''}" id="f-max" ${errs.range ? `error="${escapeHtml(errs.range)}" invalid` : ''}></ui-input>
            </div>
          ` : ''}

          ${!isNew ? `
            <div class="schema-form__meta">
              <span><strong>Source:</strong> ${isSeed ? 'Built-in' : 'User-created'}</span>
              ${applied.updatedAt ? `<span><strong>Updated:</strong> ${escapeHtml(new Date(applied.updatedAt).toLocaleString())}</span>` : ''}
            </div>
          ` : ''}
        </div>

        <div slot="footer" class="settings-footer" data-dirty="${dirty}">
          <span class="settings-footer__status">
            ${dirty
              ? (Object.keys(errs).length ? 'Fix the errors above to save.' : 'You have unsaved changes.')
              : (isNew ? 'No changes yet.' : 'All changes saved.')}
          </span>
          <ui-stack direction="row" gap="2" justify="end">
            <ui-button id="f-cancel" variant="ghost">Cancel</ui-button>
            <ui-button id="f-save" variant="primary" ${canSave ? '' : 'disabled'}>
              ${isNew ? 'Create field' : 'Save changes'}
            </ui-button>
          </ui-stack>
        </div>
      </ui-card>

      ${(!isNew && !isSeed) ? `
        <div class="schema-danger" style="margin-top: var(--space-4)">
          <strong>Delete this field</strong>
          <span class="u-text-sm u-text-muted">Deleting is permanent for this browser. Any user documents carrying this key will stop surfacing it.</span>
          <div><ui-button id="f-delete" variant="danger" size="sm">Delete field</ui-button></div>
        </div>
      ` : ''}
    `;

    // Wire inputs
    const idInput = container.querySelector('#f-id');
    const labelInput = container.querySelector('#f-label');
    const descInput = container.querySelector('#f-desc');
    const minInput = container.querySelector('#f-min');
    const maxInput = container.querySelector('#f-max');

    idInput?.addEventListener('input', (e) => {
      pending.id = (e.detail?.value ?? '').trim();
      draw();
    });
    labelInput.addEventListener('input', (e) => {
      pending.label = e.detail?.value ?? '';
      draw();
    });
    descInput.addEventListener('input', (e) => {
      pending.description = e.detail?.value ?? '';
      draw();
    });
    if (minInput) {
      minInput.addEventListener('input', (e) => {
        const v = e.detail?.value ?? '';
        pending.min = v === '' ? null : Number(v);
        draw();
      });
    }
    if (maxInput) {
      maxInput.addEventListener('input', (e) => {
        const v = e.detail?.value ?? '';
        pending.max = v === '' ? null : Number(v);
        draw();
      });
    }

    container.querySelectorAll('#f-type ui-button').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!typeEditable) return;
        const t = btn.dataset.type;
        if (t === pending.type) return;
        pending.type = t;
        // Reset type-specific extras when switching.
        pending.enumValues = [];
        pending.min = null;
        pending.max = null;
        draw();
      });
    });

    // Enum editor — string fields only
    wireEnumEditor(container, pending, draw);

    container.querySelector('#f-cancel').addEventListener('click', () => onCancel());
    container.querySelector('#f-save').addEventListener('click', () => {
      if (!canSave) return;
      onSave(pending);
    });

    container.querySelector('#f-delete')?.addEventListener('click', () => {
      if (!confirm(`Delete field "${applied.id}"? This cannot be undone.`)) return;
      onDelete();
    });
  };

  draw();

  // External schema changes shouldn't stomp on the user's draft, but if
  // the very field they're editing changed (e.g. from another tab / reset),
  // refresh the baseline so dirty state stays accurate.
  const off = appBus.on('schema:change', (e) => {
    if (!isNew && e.id === applied.id) {
      const latest = mockApi.getField(applied.id);
      if (latest) {
        applied.label = latest.label;
        applied.description = latest.description;
        applied.enumValues = [...(latest.enumValues ?? [])];
        applied.min = latest.min ?? null;
        applied.max = latest.max ?? null;
        draw();
      }
    }
  });
  signal?.addEventListener('abort', off);
}

function renderEnumEditor(values) {
  return `
    <div class="schema-enum">
      <div class="u-text-sm u-text-muted">Allowed values (optional)</div>
      <div class="schema-enum__chips" id="enum-chips">
        ${values.map((v, i) => `
          <span class="schema-enum__chip" data-index="${i}">
            ${escapeHtml(v)}
            <button type="button" aria-label="Remove" data-remove="${i}">×</button>
          </span>
        `).join('')}
      </div>
      <div class="schema-enum__add">
        <ui-input placeholder="Add a value and press Enter" id="enum-input"></ui-input>
        <ui-button id="enum-add" variant="subtle" size="sm">Add</ui-button>
      </div>
      <p class="schema-form__hint">If any values are set, users can only store one of these for this field.</p>
    </div>
  `;
}

function wireEnumEditor(container, pending, redraw) {
  if (pending.type !== 'string') return;
  const chipsEl = container.querySelector('#enum-chips');
  const inputEl = container.querySelector('#enum-input');
  const addBtn = container.querySelector('#enum-add');
  if (!chipsEl || !inputEl || !addBtn) return;

  const addCurrent = () => {
    const v = (inputEl.value ?? '').trim();
    if (!v) return;
    if (pending.enumValues.includes(v)) return;
    pending.enumValues = [...pending.enumValues, v];
    redraw();
  };

  chipsEl.querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.remove);
      pending.enumValues = pending.enumValues.filter((_, idx) => idx !== i);
      redraw();
    });
  });

  addBtn.addEventListener('click', addCurrent);
  // Enter inside the nested shadow input bubbles as keydown; listen on the host.
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCurrent();
    }
  });
}

// --- New route ------------------------------------------------------------

async function mountNew({ outlet, signal }) {
  ensureStyle();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Admin"
      title="New field"
      description="Declare a new attribute on user documents."></page-header>
    <div id="form-slot"></div>
  `;
  outlet.appendChild(wrap);

  renderForm({
    container: wrap.querySelector('#form-slot'),
    field: null,
    isNew: true,
    signal,
    onCancel: () => navigate('/schema'),
    onSave: (pending) => {
      try {
        mockApi.createField({
          id: pending.id,
          label: pending.label,
          type: pending.type,
          description: pending.description,
          enumValues: pending.type === 'string' && pending.enumValues.length ? pending.enumValues : undefined,
          min: pending.type === 'number' ? pending.min : undefined,
          max: pending.type === 'number' ? pending.max : undefined,
        });
        navigate(`/schema/${pending.id}`);
      } catch (err) {
        alert(`Could not save: ${err.message}`);
      }
    },
    onDelete: () => {}, // no delete on new
  });
}

// --- View / edit route ----------------------------------------------------

async function mountEdit({ outlet, params, signal }) {
  ensureStyle();

  const field = mockApi.getField(params.id);
  const wrap = document.createElement('section');
  wrap.className = 'u-container';

  if (!field) {
    wrap.innerHTML = `
      <page-header eyebrow="Admin" title="Field not found"></page-header>
      <ui-card>
        <p class="u-text-muted">No field exists with id <code>${escapeHtml(params.id)}</code>.</p>
        <ui-button variant="primary" id="back">Back to schema</ui-button>
      </ui-card>
    `;
    outlet.appendChild(wrap);
    wrap.querySelector('#back').addEventListener('click', () => navigate('/schema'));
    return;
  }

  wrap.innerHTML = `
    <page-header
      eyebrow="${escapeHtml(field.source === 'seed' ? 'Built-in field' : 'Custom field')}"
      title="${escapeHtml(field.label)}"
      description="${escapeHtml(field.description || 'No description.')}"></page-header>
    <div id="form-slot"></div>
  `;
  outlet.appendChild(wrap);

  renderForm({
    container: wrap.querySelector('#form-slot'),
    field,
    isNew: false,
    signal,
    onCancel: () => navigate('/schema'),
    onSave: (pending) => {
      try {
        mockApi.updateField(field.id, {
          label: pending.label,
          description: pending.description,
          enumValues: field.type === 'string' ? pending.enumValues : undefined,
          min: field.type === 'number' ? pending.min : undefined,
          max: field.type === 'number' ? pending.max : undefined,
        });
      } catch (err) {
        alert(`Could not save: ${err.message}`);
      }
    },
    onDelete: () => {
      try {
        mockApi.deleteField(field.id);
        navigate('/schema');
      } catch (err) {
        alert(`Could not delete: ${err.message}`);
      }
    },
  });
}

export const routes = [
  { path: '/schema',       mount: mountList },
  { path: '/schema/new',   mount: mountNew },
  { path: '/schema/:id',   mount: mountEdit },
];
