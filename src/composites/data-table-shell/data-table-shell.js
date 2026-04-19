import { defineOnce, escapeHtml } from '../../utils/dom.js';
import { dispatch } from '../../utils/events.js';

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
//
// Columns: { key, label, render?, priority?: 'title' | 'subtitle' | 'meta' | 'hide-mobile' }
// Priority drives the mobile card layout. Defaults: column 0 = title,
// everything else = meta. Desktop always shows the full table.
//
// Emits 'row-click' with detail: { row, index } from either the table or
// the card view — callers should listen for that instead of walking up to
// find a <tr>, which breaks when the mobile card layout is active.
class DataTableShell extends HTMLElement {
  static get observedAttributes() { return ['title', 'count']; }

  connectedCallback() {
    ensureStyle();
    this.classList.add('data-table-shell');
    this._render();
  }

  attributeChangedCallback() { if (this.isConnected) this._render(); }

  set columns(c) { this._columns = c; this._syncTable(); this._renderCards(); }
  set rows(r) { this._rows = r; this._syncTable(); this._renderCards(); }

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
      <ui-table class="data-table-shell__table"></ui-table>
      <div class="data-table-shell__cards" role="list"></div>
    `;
    if (actions) {
      actions.removeAttribute('slot');
      actions.classList.add('data-table-shell__actions');
      this.querySelector('.data-table-shell__head').appendChild(actions);
    }
    this._syncTable();
    this._renderCards();
    this._wireRowClicks();
  }

  _syncTable() {
    const table = this.querySelector('ui-table');
    if (!table) return;
    if (this._columns) table.columns = this._columns;
    if (this._rows) table.rows = this._rows;
  }

  _renderCards() {
    const cards = this.querySelector('.data-table-shell__cards');
    if (!cards) return;
    const cols = this._columns ?? [];
    const rows = this._rows ?? [];
    if (!cols.length || !rows.length) {
      cards.innerHTML = rows.length ? '' : `<div class="data-table-shell__empty">No data to display.</div>`;
      return;
    }

    const roleFor = (col, idx) => col.priority ?? (idx === 0 ? 'title' : 'meta');
    const visible = cols.filter((c, i) => roleFor(c, i) !== 'hide-mobile');

    const titleCol = visible.find((c, i) => roleFor(c, cols.indexOf(c)) === 'title') ?? visible[0];
    const subCols = visible.filter((c) => roleFor(c, cols.indexOf(c)) === 'subtitle');
    const metaCols = visible.filter((c) => {
      const r = roleFor(c, cols.indexOf(c));
      return r === 'meta' || (r !== 'title' && r !== 'subtitle' && c !== titleCol);
    });

    const render = (col, row) =>
      typeof col.render === 'function' ? col.render(row) : row[col.key];

    const stringify = (v) => v == null ? '' : String(v);

    cards.innerHTML = rows.map((row, i) => `
      <button type="button" class="dts-card" role="listitem" data-index="${i}">
        <div class="dts-card__title">${escapeHtml(stringify(render(titleCol, row)))}</div>
        ${subCols.length ? `
          <div class="dts-card__subtitle">
            ${subCols.map((c) => `<span>${escapeHtml(stringify(render(c, row)))}</span>`).join('<span aria-hidden="true"> · </span>')}
          </div>
        ` : ''}
        ${metaCols.length ? `
          <dl class="dts-card__meta">
            ${metaCols.map((c) => `
              <div>
                <dt>${escapeHtml(c.label ?? c.key)}</dt>
                <dd>${escapeHtml(stringify(render(c, row)))}</dd>
              </div>
            `).join('')}
          </dl>
        ` : ''}
      </button>
    `).join('');
  }

  _wireRowClicks() {
    // Cards: each .dts-card is a <button> with data-index.
    this.querySelector('.data-table-shell__cards')?.addEventListener('click', (e) => {
      const card = e.target.closest('.dts-card');
      if (!card) return;
      const index = Number(card.dataset.index);
      const row = this._rows?.[index];
      if (row) dispatch(this, 'row-click', { row, index });
    });

    // Table: delegate through the shadow DOM by finding the <tr>.
    this.querySelector('ui-table')?.addEventListener('click', (e) => {
      const tr = e.composedPath().find((el) => el && el.tagName === 'TR');
      if (!tr) return;
      const tbody = tr.parentElement;
      if (!tbody || tbody.tagName !== 'TBODY') return;
      const index = [...tbody.children].indexOf(tr);
      const row = this._rows?.[index];
      if (row) dispatch(this, 'row-click', { row, index });
    });
  }
}

defineOnce('data-table-shell', DataTableShell);
export { DataTableShell };
