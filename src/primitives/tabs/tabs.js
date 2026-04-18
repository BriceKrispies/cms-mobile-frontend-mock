import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet } from '../_shared.js';

const CSS_URL = new URL('./tabs.css', import.meta.url).href;

// Usage:
// <ui-tabs>
//   <button slot="tab" data-tab="a">A</button>
//   <button slot="tab" data-tab="b">B</button>
//   <div slot="panel" data-panel="a">...</div>
//   <div slot="panel" data-panel="b">...</div>
// </ui-tabs>
class UITabs extends HTMLElement {
  static get observedAttributes() { return ['value']; }

  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `
      <div class="tabs" role="tablist"><slot name="tab"></slot></div>
      <div class="panel"><slot name="panel"></slot></div>
    `;
    this.addEventListener('click', (e) => {
      const tab = e.target.closest('[slot="tab"]');
      if (!tab) return;
      const id = tab.dataset.tab;
      if (id) this.value = id;
    });
  }

  connectedCallback() {
    if (!this.hasAttribute('value')) {
      const first = this.querySelector('[slot="tab"]');
      if (first?.dataset.tab) this.setAttribute('value', first.dataset.tab);
    }
    this._sync();
  }

  attributeChangedCallback() { this._sync(); }

  get value() { return this.getAttribute('value'); }
  set value(v) { this.setAttribute('value', v); this.dispatchEvent(new CustomEvent('change', { detail: { value: v }, bubbles: true })); }

  _sync() {
    const active = this.getAttribute('value');
    this.querySelectorAll('[slot="tab"]').forEach((t) => {
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(t.dataset.tab === active));
    });
    this.querySelectorAll('[slot="panel"]').forEach((p) => {
      p.hidden = p.dataset.panel !== active;
    });
  }
}

defineOnce('ui-tabs', UITabs);
export { UITabs };
