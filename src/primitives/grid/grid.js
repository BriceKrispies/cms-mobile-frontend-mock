import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet } from '../_shared.js';

const CSS_URL = new URL('./grid.css', import.meta.url).href;

class UIGrid extends HTMLElement {
  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `<div class="grid" part="grid"><slot></slot></div>`;
  }
}

defineOnce('ui-grid', UIGrid);
export { UIGrid };
