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

// Wraps a <ui-table> with a header (title, count, actions slot) and an
// optional controls bar for per-column sort + filter.
//
// Columns:
//   { key, label, render?,
//     priority?: 'title' | 'subtitle' | 'meta' | 'hide-mobile',
//     sortable?: boolean,
//     type?: 'text' | 'number' | 'date',   // drives the sort comparator
//     filter?: 'text' | 'enum' | false,
//     sortValue?: (row) => any,            // override for sort comparator
//     filterValue?: (row) => string }      // override for filter matching
//
// Priority drives the mobile card layout. sortable/filter/type drive the
// controls bar. The underlying <ui-table> is untouched — sort+filter are
// applied here by computing a view of the rows before handing them off.
//
// Emits 'row-click' with detail: { row, index } where row is from the
// current view (post-filter/sort) and index is the view index.
class DataTableShell extends HTMLElement {
  static get observedAttributes() { return ['title', 'count']; }

  constructor() {
    super();
    this._sort = null;           // { key, dir: 'asc' | 'desc' }
    this._filters = {};          // { [key]: string }
  }

  connectedCallback() {
    ensureStyle();
    this.classList.add('data-table-shell');
    this._render();
  }

  attributeChangedCallback() { if (this.isConnected) this._renderHead(); }

  set columns(c) { this._columns = c; this._sort = this._defaultSort(); this._update(); }
  set rows(r) { this._rows = r; this._update(); }

  _defaultSort() {
    // If caller sets sortable: true with an explicit default, we'd honor it;
    // otherwise leave unsorted so natural row order wins.
    return null;
  }

  _hasControls() {
    const cols = this._columns ?? [];
    return cols.some((c) => c.sortable || c.filter);
  }

  _render() {
    // Preserve any [slot="actions"] child before we blow away innerHTML.
    const actionsSlot = this.querySelector(':scope > [slot="actions"]');
    if (actionsSlot) this._savedActions = actionsSlot.cloneNode(true);

    this.innerHTML = `
      <div class="data-table-shell__head"></div>
      <div class="data-table-shell__controls" hidden></div>
      <ui-table class="data-table-shell__table"></ui-table>
      <div class="data-table-shell__cards" role="list"></div>
    `;
    this._renderHead();
    this._renderControls();
    this._update();
    this._wireRowClicks();
  }

  _renderHead() {
    const head = this.querySelector('.data-table-shell__head');
    if (!head) return;
    const title = escapeHtml(this.getAttribute('title') || 'Records');
    const total = this._rows?.length ?? 0;
    const shown = this._viewRows?.length ?? total;
    const countAttr = this.getAttribute('count');
    const countText = countAttr != null
      ? (shown !== total ? `${shown} of ${countAttr} shown` : `${countAttr} total`)
      : null;

    head.innerHTML = `
      <div>
        <div class="data-table-shell__title">${title}</div>
        ${countText ? `<div class="data-table-shell__meta">${escapeHtml(countText)}</div>` : ''}
      </div>
    `;
    if (this._savedActions) {
      const actions = this._savedActions.cloneNode(true);
      actions.removeAttribute('slot');
      actions.classList.add('data-table-shell__actions');
      head.appendChild(actions);
    }
  }

  _renderControls() {
    const bar = this.querySelector('.data-table-shell__controls');
    if (!bar) return;
    const cols = this._columns ?? [];
    if (!this._hasControls()) { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;

    const filterable = cols.filter((c) => c.filter);
    const sortable = cols.filter((c) => c.sortable);

    const filtersHtml = filterable.map((c) => {
      const id = `dts-f-${c.key}`;
      const label = escapeHtml(c.label ?? c.key);
      const value = escapeHtml(this._filters[c.key] ?? '');
      if (c.filter === 'enum') {
        const opts = this._enumOptions(c);
        return `
          <label class="dts-ctrl" for="${id}">
            <span class="dts-ctrl__label">${label}</span>
            <select class="dts-ctrl__input" data-filter="${escapeHtml(c.key)}" id="${id}">
              <option value="">All</option>
              ${opts.map((o) => `<option value="${escapeHtml(o)}"${o === this._filters[c.key] ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}
            </select>
          </label>
        `;
      }
      return `
        <label class="dts-ctrl" for="${id}">
          <span class="dts-ctrl__label">${label}</span>
          <input type="search" class="dts-ctrl__input" data-filter="${escapeHtml(c.key)}" id="${id}" placeholder="Filter…" value="${value}">
        </label>
      `;
    }).join('');

    const sortHtml = sortable.length ? `
      <label class="dts-ctrl dts-ctrl--sort">
        <span class="dts-ctrl__label">Sort</span>
        <span class="dts-ctrl__group">
          <select class="dts-ctrl__input" data-sort="key">
            <option value="">None</option>
            ${sortable.map((c) => `<option value="${escapeHtml(c.key)}"${this._sort?.key === c.key ? ' selected' : ''}>${escapeHtml(c.label ?? c.key)}</option>`).join('')}
          </select>
          <button type="button" class="dts-ctrl__dir" data-sort="dir" aria-label="Toggle sort direction" ${this._sort ? '' : 'disabled'}>
            ${this._sort?.dir === 'desc' ? '↓' : '↑'}
          </button>
        </span>
      </label>
    ` : '';

    bar.innerHTML = `
      ${filtersHtml ? `<div class="dts-ctrl-group">${filtersHtml}</div>` : ''}
      ${sortHtml ? `<div class="dts-ctrl-group dts-ctrl-group--end">${sortHtml}</div>` : ''}
      ${this._isViewFiltered() ? `<button type="button" class="dts-ctrl__reset" data-reset>Reset</button>` : ''}
    `;

    bar.querySelectorAll('[data-filter]').forEach((el) => {
      const key = el.dataset.filter;
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, (e) => {
        const v = e.target.value;
        if (v) this._filters[key] = v; else delete this._filters[key];
        this._update({ preserveFocus: el.id });
      });
    });

    const keySel = bar.querySelector('[data-sort="key"]');
    keySel?.addEventListener('change', (e) => {
      const key = e.target.value;
      this._sort = key ? { key, dir: this._sort?.dir ?? 'asc' } : null;
      this._update();
    });

    bar.querySelector('[data-sort="dir"]')?.addEventListener('click', () => {
      if (!this._sort) return;
      this._sort = { ...this._sort, dir: this._sort.dir === 'asc' ? 'desc' : 'asc' };
      this._update();
    });

    bar.querySelector('[data-reset]')?.addEventListener('click', () => {
      this._filters = {};
      this._sort = null;
      this._update();
    });
  }

  _isViewFiltered() {
    return this._sort != null || Object.keys(this._filters).length > 0;
  }

  _enumOptions(col) {
    const rows = this._rows ?? [];
    const seen = new Set();
    for (const row of rows) {
      const v = this._filterValue(col, row);
      if (v !== '' && v != null) seen.add(v);
    }
    return [...seen].sort((a, b) => String(a).localeCompare(String(b)));
  }

  _sortValue(col, row) {
    if (typeof col.sortValue === 'function') return col.sortValue(row);
    const raw = row[col.key];
    if (raw != null && typeof raw !== 'object') return raw;
    if (typeof col.render === 'function') {
      const r = col.render(row);
      if (r != null && typeof r !== 'object') return r;
    }
    return raw;
  }

  _filterValue(col, row) {
    if (typeof col.filterValue === 'function') return String(col.filterValue(row) ?? '');
    const v = this._sortValue(col, row);
    return v == null ? '' : String(v);
  }

  _compare(col, a, b) {
    const av = this._sortValue(col, a);
    const bv = this._sortValue(col, b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (col.type === 'number') return Number(av) - Number(bv);
    if (col.type === 'date') return new Date(av).getTime() - new Date(bv).getTime();
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  }

  _computeView() {
    const rows = this._rows ?? [];
    const cols = this._columns ?? [];
    let view = rows;

    const activeFilters = Object.entries(this._filters).filter(([, v]) => v !== '' && v != null);
    if (activeFilters.length) {
      view = view.filter((row) => activeFilters.every(([key, needle]) => {
        const col = cols.find((c) => c.key === key);
        if (!col) return true;
        const hay = this._filterValue(col, row);
        if (col.filter === 'enum') return hay === needle;
        return hay.toLowerCase().includes(String(needle).toLowerCase());
      }));
    }

    if (this._sort) {
      const col = cols.find((c) => c.key === this._sort.key);
      if (col) {
        const dir = this._sort.dir === 'desc' ? -1 : 1;
        view = [...view].sort((a, b) => dir * this._compare(col, a, b));
      }
    }

    this._viewRows = view;
  }

  _update({ preserveFocus } = {}) {
    this._computeView();
    this._syncTable();
    this._renderCards();
    this._renderHead();
    this._renderControls();
    if (preserveFocus) {
      const el = this.querySelector(`#${CSS.escape(preserveFocus)}`);
      if (el) {
        el.focus();
        if (typeof el.setSelectionRange === 'function') {
          const end = el.value.length;
          try { el.setSelectionRange(end, end); } catch {}
        }
      }
    }
  }

  _syncTable() {
    const table = this.querySelector('ui-table');
    if (!table) return;
    if (this._columns) table.columns = this._columns;
    table.rows = this._viewRows ?? this._rows ?? [];
  }

  _renderCards() {
    const cards = this.querySelector('.data-table-shell__cards');
    if (!cards) return;
    const cols = this._columns ?? [];
    const rows = this._viewRows ?? this._rows ?? [];
    if (!cols.length || !rows.length) {
      cards.innerHTML = rows.length ? '' : `<div class="data-table-shell__empty">No data to display.</div>`;
      return;
    }

    const roleFor = (col, idx) => col.priority ?? (idx === 0 ? 'title' : 'meta');
    const visible = cols.filter((c, i) => roleFor(c, i) !== 'hide-mobile');

    const titleCol = visible.find((c) => roleFor(c, cols.indexOf(c)) === 'title') ?? visible[0];
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
    this.querySelector('.data-table-shell__cards')?.addEventListener('click', (e) => {
      const card = e.target.closest('.dts-card');
      if (!card) return;
      const index = Number(card.dataset.index);
      const row = this._viewRows?.[index] ?? this._rows?.[index];
      if (row) dispatch(this, 'row-click', { row, index });
    });

    this.querySelector('ui-table')?.addEventListener('click', (e) => {
      const tr = e.composedPath().find((el) => el && el.tagName === 'TR');
      if (!tr) return;
      const tbody = tr.parentElement;
      if (!tbody || tbody.tagName !== 'TBODY') return;
      const index = [...tbody.children].indexOf(tr);
      const row = this._viewRows?.[index] ?? this._rows?.[index];
      if (row) dispatch(this, 'row-click', { row, index });
    });
  }
}

defineOnce('data-table-shell', DataTableShell);
export { DataTableShell };
