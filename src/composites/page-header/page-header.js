import { defineOnce } from '../../utils/dom.js';

const styleUrl = new URL('./page-header.css', import.meta.url).href;

let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

// Light-DOM composite: easier for features to slot content directly.
// Attributes: eyebrow, title, description.
class PageHeader extends HTMLElement {
  static get observedAttributes() { return ['eyebrow', 'title', 'description']; }

  connectedCallback() {
    ensureStyle();
    this.classList.add('page-header');
    this._render();
  }

  attributeChangedCallback() { if (this.isConnected) this._render(); }

  _render() {
    const actionsSlot = this.querySelector('[slot="actions"]');
    const actions = actionsSlot ? actionsSlot.cloneNode(true) : null;

    const eyebrow = this.getAttribute('eyebrow');
    const title = this.getAttribute('title') || '';
    const description = this.getAttribute('description');

    this.innerHTML = `
      <div class="page-header__top">
        <div>
          ${eyebrow ? `<div class="page-header__eyebrow">${eyebrow}</div>` : ''}
          <h1 class="page-header__title">${title}</h1>
          ${description ? `<p class="page-header__description">${description}</p>` : ''}
        </div>
      </div>
    `;

    if (actions) {
      actions.removeAttribute('slot');
      actions.classList.add('page-header__actions');
      this.appendChild(actions);
    }
  }
}

defineOnce('page-header', PageHeader);
export { PageHeader };
