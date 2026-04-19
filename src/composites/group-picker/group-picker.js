import { defineOnce, escapeHtml } from '../../utils/dom.js';
import { mockApi } from '../../mock-data/api/mockApi.js';
import { dispatch, appBus } from '../../utils/events.js';

const styleUrl = new URL('./group-picker.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

// <group-picker> — pick an existing group or build an ad-hoc one.
// Set .value to { groupId } or { definition }, listen for 'change'.
class GroupPicker extends HTMLElement {
  constructor() {
    super();
    this._value = { groupId: null };
    this._mode = 'pick'; // 'pick' | 'build'
  }

  connectedCallback() {
    ensureStyle();
    this.classList.add('group-picker');
    this._render();
    this._off = appBus.on('groups:change', () => this._render());
  }

  disconnectedCallback() { this._off?.(); }

  set value(v) {
    this._value = v && typeof v === 'object' ? v : { groupId: null };
    this._mode = this._value.definition ? 'build' : 'pick';
    if (this.isConnected) this._render();
  }
  get value() { return { ...this._value }; }

  _emit() {
    dispatch(this, 'change', { value: { ...this._value } });
  }

  _render() {
    const groups = mockApi.listGroups();
    this.innerHTML = `
      <div class="group-picker__tabs">
        <button type="button" data-mode="pick" class="${this._mode === 'pick' ? 'is-active' : ''}">Pick existing</button>
        <button type="button" data-mode="build" class="${this._mode === 'build' ? 'is-active' : ''}">Build custom</button>
      </div>
      <div class="group-picker__body" id="picker-body"></div>
    `;
    this.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this._mode) return;
        this._mode = mode;
        if (mode === 'pick') {
          this._value = { groupId: groups[0]?.id ?? null };
        } else {
          this._value = { definition: { kind: 'and', children: [] } };
        }
        this._render();
        this._emit();
      });
    });

    const body = this.querySelector('#picker-body');
    if (this._mode === 'pick') {
      body.innerHTML = `
        <select class="group-picker__select">
          <option value="" disabled ${this._value.groupId ? '' : 'selected'}>Pick a group…</option>
          ${groups.map((g) => `<option value="${escapeHtml(g.id)}" ${g.id === this._value.groupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
        </select>
      `;
      const select = body.querySelector('select');
      select.addEventListener('change', () => {
        this._value = { groupId: select.value };
        this._emit();
        this._renderPreview();
      });
      this._renderPreview();
    } else {
      const builder = document.createElement('group-builder');
      builder.definition = this._value.definition;
      builder.addEventListener('change', (e) => {
        this._value = { definition: e.detail.definition };
        this._emit();
        this._renderPreview();
      });
      body.appendChild(builder);

      const preview = document.createElement('div');
      preview.className = 'group-picker__preview';
      preview.id = 'picker-preview';
      body.appendChild(preview);
      this._renderPreview();
    }
  }

  _renderPreview() {
    const target = this.querySelector('.group-picker__body');
    if (!target) return;
    let preview = this.querySelector('#picker-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'group-picker__preview';
      preview.id = 'picker-preview';
      target.appendChild(preview);
    }
    let result;
    if (this._mode === 'pick' && this._value.groupId) {
      result = mockApi.resolveGroup(this._value.groupId);
    } else if (this._mode === 'build' && this._value.definition) {
      result = mockApi.previewDefinition(this._value.definition);
    } else {
      preview.innerHTML = '';
      return;
    }
    preview.innerHTML = `
      <span class="group-picker__count"><strong>${result.count}</strong> ${result.count === 1 ? 'person matches' : 'people match'}</span>
      ${result.errors.length ? `<span class="group-picker__errors">${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}</span>` : ''}
    `;
  }
}

defineOnce('group-picker', GroupPicker);
export { GroupPicker };
