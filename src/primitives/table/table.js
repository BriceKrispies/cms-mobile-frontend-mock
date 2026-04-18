import { defineOnce, shadow, escapeHtml } from '../../utils/dom.js';
import { attachStylesheet } from '../_shared.js';

const CSS_URL = new URL('./table.css', import.meta.url).href;

// Data-driven table. Set .columns = [{key, label, render?}] and .rows = [...].
class UITable extends HTMLElement {
  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `<div class="wrap" part="wrap"></div>`;
    this._wrap = root.querySelector('.wrap');
    this._columns = [];
    this._rows = [];
  }

  set columns(cols) { this._columns = cols || []; this._render(); }
  get columns() { return this._columns; }
  set rows(rows) { this._rows = rows || []; this._render(); }
  get rows() { return this._rows; }

  _render() {
    if (!this._columns.length) { this._wrap.innerHTML = ''; return; }
    if (!this._rows.length) {
      this._wrap.innerHTML = `<div class="empty">No data to display.</div>`;
      return;
    }
    const header = this._columns.map((c) => `<th scope="col">${escapeHtml(c.label ?? c.key)}</th>`).join('');
    const body = this._rows.map((row) =>
      `<tr>${this._columns.map((c) => {
        const v = typeof c.render === 'function' ? c.render(row) : row[c.key];
        return `<td>${v == null ? '' : (typeof v === 'string' ? escapeHtml(v) : escapeHtml(String(v)))}</td>`;
      }).join('')}</tr>`
    ).join('');
    this._wrap.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  }
}

defineOnce('ui-table', UITable);
export { UITable };
