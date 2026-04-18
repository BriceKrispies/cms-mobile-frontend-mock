import { defineOnce, shadow } from '../../utils/dom.js';
import { attachStylesheet } from '../_shared.js';

const CSS_URL = new URL('./stack.css', import.meta.url).href;

class UIStack extends HTMLElement {
  constructor() {
    super();
    const root = shadow(this);
    attachStylesheet(root, CSS_URL);
    root.innerHTML += `<div class="stack" part="stack"><slot></slot></div>`;
  }
}

defineOnce('ui-stack', UIStack);
export { UIStack };
