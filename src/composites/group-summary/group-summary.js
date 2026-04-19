import { defineOnce, escapeHtml } from '../../utils/dom.js';
import { mockApi } from '../../mock-data/api/mockApi.js';
import { navigate } from '../../app/router.js';
import { appBus } from '../../utils/events.js';

const styleUrl = new URL('./group-summary.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

function initials(name) {
  return name?.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';
}

// Read-only summary card for a group. Set .groupId or attribute group-id.
// Re-renders on schema/groups change events. Set linked="false" to disable
// click-through to /groups/:id.
class GroupSummary extends HTMLElement {
  static get observedAttributes() { return ['group-id', 'linked']; }

  connectedCallback() {
    ensureStyle();
    this.classList.add('group-summary');
    this._render();
    this._off = [
      appBus.on('groups:change', () => this._render()),
      appBus.on('schema:change', () => this._render()),
      appBus.on('mock:scenario-changed', () => this._render()),
    ];
  }

  disconnectedCallback() {
    this._off?.forEach((fn) => fn());
  }

  attributeChangedCallback() { if (this.isConnected) this._render(); }

  set groupId(id) { this.setAttribute('group-id', id); }
  get groupId() { return this.getAttribute('group-id'); }

  _render() {
    const id = this.getAttribute('group-id');
    const linked = this.getAttribute('linked') !== 'false';
    if (!id) { this.innerHTML = ''; return; }

    const group = mockApi.getGroup(id);
    if (!group) {
      this.innerHTML = `
        <div class="group-summary__missing">
          <ui-badge tone="warning" size="sm">Missing</ui-badge>
          <span>Group <code>${escapeHtml(id)}</code> not found.</span>
        </div>
      `;
      return;
    }

    const { users, count, errors } = mockApi.resolveGroup(id);
    const sample = users.slice(0, 5);

    this.innerHTML = `
      <div class="group-summary__head">
        <div>
          <div class="group-summary__name">${escapeHtml(group.name)}</div>
          ${group.description ? `<div class="group-summary__desc">${escapeHtml(group.description)}</div>` : ''}
        </div>
        <ui-badge tone="${group.source === 'seed' ? 'info' : 'primary'}" size="sm">
          ${group.source === 'seed' ? 'Built-in' : 'Custom'}
        </ui-badge>
      </div>
      <div class="group-summary__count">
        <strong>${count}</strong>
        <span>${count === 1 ? 'person' : 'people'}</span>
        ${errors.length ? `<ui-badge tone="warning" size="sm">${errors.length} issue${errors.length === 1 ? '' : 's'}</ui-badge>` : ''}
      </div>
      ${sample.length ? `
        <div class="group-summary__sample">
          ${sample.map((u) => `
            <span class="group-summary__avatar" title="${escapeHtml(u.name || u.id)}">${escapeHtml(initials(u.name))}</span>
          `).join('')}
          ${count > sample.length ? `<span class="group-summary__more">+${count - sample.length}</span>` : ''}
        </div>
      ` : '<div class="group-summary__empty">No people match.</div>'}
      ${linked ? `<a class="group-summary__link" data-link>View group →</a>` : ''}
    `;

    if (linked) {
      this.querySelector('[data-link]')?.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(`/groups/${id}`);
      });
    }
  }
}

defineOnce('group-summary', GroupSummary);
export { GroupSummary };
