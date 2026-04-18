import { defineOnce, escapeHtml } from '../../utils/dom.js';

const styleUrl = new URL('./filter-bar.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

// Set .chips to an array of { id, label } and listen for 'filter-change'.
// Attributes: placeholder (search placeholder), value, active (chip id).
class FilterBar extends HTMLElement {
  constructor() {
    super();
    this._chips = [];
    this._active = null;
    this._value = '';
  }

  connectedCallback() { ensureStyle(); this._render(); }

  set chips(v) { this._chips = v || []; if (this.isConnected) this._render(); }
  set active(id) { this._active = id; if (this.isConnected) this._render(); }
  get value() { return this._value; }

  _emit() {
    this.dispatchEvent(new CustomEvent('filter-change', {
      detail: { search: this._value, active: this._active },
      bubbles: true,
    }));
  }

  _render() {
    const placeholder = this.getAttribute('placeholder') || 'Search…';

    this.classList.add('filter-bar');
    this.innerHTML = `
      <div class="filter-bar__row">
        <ui-input class="filter-bar__search" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(this._value)}"></ui-input>
      </div>
      <div class="filter-bar__chips" role="tablist">
        ${this._chips.map((c) =>
          `<button type="button" class="chip" data-chip="${escapeHtml(c.id)}" aria-pressed="${c.id === this._active}">${escapeHtml(c.label)}</button>`
        ).join('')}
      </div>
    `;

    const input = this.querySelector('ui-input');
    input.addEventListener('input', (e) => { this._value = e.detail?.value ?? ''; this._emit(); });

    this.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        this._active = chip.dataset.chip;
        this.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        this._emit();
      });
    });
  }
}

defineOnce('filter-bar', FilterBar);
export { FilterBar };
