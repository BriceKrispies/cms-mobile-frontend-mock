import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet } from '../_shared.js';

const CSS_URL = new URL('./card.css', import.meta.url).href;

class UICard extends HTMLElement {
  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `
      <article class="card" part="card">
        <header class="card__header"><slot name="title"></slot><slot name="actions"></slot></header>
        <slot></slot>
        <footer class="card__footer"><slot name="footer"></slot></footer>
      </article>
    `;
  }

  connectedCallback() {
    if (this.hasAttribute('interactive') && !this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
    }
  }
}

defineOnce('ui-card', UICard);
export { UICard };
