import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet } from '../_shared.js';

const CSS_URL = new URL('./button.css', import.meta.url).href;

class UIButton extends HTMLElement {
  static get observedAttributes() {
    return ['disabled', 'type', 'variant', 'size', 'full'];
  }

  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `
      <button class="btn" part="button" type="button">
        <slot name="leading"></slot>
        <span class="btn__slot"><slot></slot></span>
        <slot name="trailing"></slot>
      </button>
    `;
    this._btn = root.querySelector('button');
  }

  connectedCallback() {
    this._syncAttrs();
    this._btn.addEventListener('click', (e) => {
      if (this.hasAttribute('disabled')) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    });
  }

  attributeChangedCallback() { this._syncAttrs(); }

  _syncAttrs() {
    if (!this._btn) return;
    this._btn.disabled = this.hasAttribute('disabled');
    this._btn.type = this.getAttribute('type') || 'button';
  }
}

defineOnce('ui-button', UIButton);
export { UIButton };
