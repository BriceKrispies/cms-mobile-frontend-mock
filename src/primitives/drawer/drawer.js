import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet, reflectAttr } from '../_shared.js';

const CSS_URL = new URL('./drawer.css', import.meta.url).href;

class UIDrawer extends HTMLElement {
  static get observedAttributes() { return ['open', 'side']; }

  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `
      <div class="scrim" part="scrim"></div>
      <aside class="drawer" part="drawer" role="dialog" aria-modal="true">
        <slot></slot>
      </aside>
    `;
    this._scrim = root.querySelector('.scrim');
    this._scrim.addEventListener('click', () => this.close());
    this._onKey = (e) => { if (e.key === 'Escape' && this.hasAttribute('open')) this.close(); };
  }

  connectedCallback() { document.addEventListener('keydown', this._onKey); }
  disconnectedCallback() { document.removeEventListener('keydown', this._onKey); }

  open() { reflectAttr(this, 'open', true); this.dispatchEvent(new CustomEvent('open', { bubbles: true })); }
  close() { reflectAttr(this, 'open', false); this.dispatchEvent(new CustomEvent('close', { bubbles: true })); }
  toggle() { this.hasAttribute('open') ? this.close() : this.open(); }
}

defineOnce('ui-drawer', UIDrawer);
export { UIDrawer };
