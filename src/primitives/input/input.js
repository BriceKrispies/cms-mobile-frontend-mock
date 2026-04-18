import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet } from '../_shared.js';

const CSS_URL = new URL('./input.css', import.meta.url).href;

class UIInput extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'placeholder', 'type', 'value', 'name', 'disabled', 'invalid', 'hint', 'error'];
  }

  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `
      <label class="field">
        <span class="field__label" part="label"></span>
        <span class="field__control" part="control">
          <slot name="leading"></slot>
          <input class="field__input" part="input" />
          <slot name="trailing"></slot>
        </span>
        <span class="field__hint" part="hint"></span>
        <span class="field__error" part="error"></span>
      </label>
    `;
    this._label = root.querySelector('.field__label');
    this._input = root.querySelector('input');
    this._hint = root.querySelector('.field__hint');
    this._error = root.querySelector('.field__error');

    this._input.addEventListener('input', () => {
      this.setAttribute('value', this._input.value);
      this.dispatchEvent(new CustomEvent('input', { detail: { value: this._input.value }, bubbles: true, composed: true }));
    });
    this._input.addEventListener('change', () => {
      this.dispatchEvent(new CustomEvent('change', { detail: { value: this._input.value }, bubbles: true, composed: true }));
    });
  }

  connectedCallback() { this._sync(); }
  attributeChangedCallback() { this._sync(); }

  get value() { return this._input?.value ?? ''; }
  set value(v) { if (this._input) this._input.value = v ?? ''; }

  _sync() {
    if (!this._input) return;
    const label = this.getAttribute('label');
    this._label.textContent = label || '';
    this._label.hidden = !label;

    this._input.type = this.getAttribute('type') || 'text';
    this._input.placeholder = this.getAttribute('placeholder') || '';
    this._input.name = this.getAttribute('name') || '';
    this._input.disabled = this.hasAttribute('disabled');
    if (this.hasAttribute('value')) this._input.value = this.getAttribute('value');

    const hint = this.getAttribute('hint');
    this._hint.textContent = hint || '';
    this._hint.hidden = !hint;

    const error = this.getAttribute('error');
    this._error.textContent = error || '';
    this._error.hidden = !error;
  }
}

defineOnce('ui-input', UIInput);
export { UIInput };
