import { defineOnce, escapeHtml } from '../../utils/dom.js';

const styleUrl = new URL('./data-table-shell.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

// Wraps a <ui-table> with a header (title, count, actions slot).
// Set .columns and .rows directly; set .title/.count via attributes.
class DataTableShell extends HTMLElement {
  static get observedAttributes() { return ['title', 'count']; }

  connectedCallback() {
    ensureStyle();
    this.classList.add('data-table-shell');
    this._render();
  }

  attributeChangedCallback() { if (this.isConnected) this._render(); }

  set columns(c) { this._columns = c; this._syncTable(); }
  set rows(r) { this._rows = r; this._syncTable(); }

  _render() {
    const title = escapeHtml(this.getAttribute('title') || 'Records');
    const count = this.getAttribute('count');
    const actionsSlot = this.querySelector('[slot="actions"]');
    const actions = actionsSlot ? actionsSlot.cloneNode(true) : null;

    this.innerHTML = `
      <div class="data-table-shell__head">
        <div>
          <div class="data-table-shell__title">${title}</div>
          ${count != null ? `<div class="data-table-shell__meta">${escapeHtml(count)} total</div>` : ''}
        </div>
      </div>
      <ui-table></ui-table>
    `;
    if (actions) {
      actions.removeAttribute('slot');
      actions.classList.add('data-table-shell__actions');
      this.querySelector('.data-table-shell__head').appendChild(actions);
    }
    this._syncTable();
  }

  _syncTable() {
    const table = this.querySelector('ui-table');
    if (!table) return;
    if (this._columns) table.columns = this._columns;
    if (this._rows) table.rows = this._rows;
  }
}

defineOnce('data-table-shell', DataTableShell);
export { DataTableShell };
