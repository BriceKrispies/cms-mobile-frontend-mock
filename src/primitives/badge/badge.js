import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet } from '../_shared.js';

const CSS_URL = new URL('./badge.css', import.meta.url).href;

class UIBadge extends HTMLElement {
  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `<span class="badge" part="badge"><slot></slot></span>`;
  }
}

defineOnce('ui-badge', UIBadge);
export { UIBadge };
