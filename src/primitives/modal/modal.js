import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet, reflectAttr } from '../_shared.js';

const CSS_URL = new URL('./modal.css', import.meta.url).href;

class UIModal extends HTMLElement {
  static get observedAttributes() { return ['open', 'label']; }

  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `
      <div class="scrim" part="scrim" role="presentation">
        <div class="modal" part="modal" role="dialog" aria-modal="true">
          <header class="modal__header">
            <h2 class="modal__title" part="title"></h2>
            <button class="modal__close" type="button" aria-label="Close">&times;</button>
          </header>
          <slot></slot>
        </div>
      </div>
    `;
    this._scrim = root.querySelector('.scrim');
    this._modal = root.querySelector('.modal');
    this._title = root.querySelector('.modal__title');
    this._close = root.querySelector('.modal__close');

    this._scrim.addEventListener('click', (e) => { if (e.target === this._scrim) this.close(); });
    this._close.addEventListener('click', () => this.close());
    this._onKey = (e) => { if (e.key === 'Escape' && this.hasAttribute('open')) this.close(); };
  }

  connectedCallback() { this._sync(); document.addEventListener('keydown', this._onKey); }
  disconnectedCallback() { document.removeEventListener('keydown', this._onKey); }
  attributeChangedCallback() { this._sync(); }

  open() { reflectAttr(this, 'open', true); this.dispatchEvent(new CustomEvent('open', { bubbles: true })); }
  close() { reflectAttr(this, 'open', false); this.dispatchEvent(new CustomEvent('close', { bubbles: true })); }

  _sync() {
    const label = this.getAttribute('label') || '';
    this._title.textContent = label;
    this._title.hidden = !label;
    this._modal.setAttribute('aria-label', label);
  }
}

defineOnce('ui-modal', UIModal);
export { UIModal };
