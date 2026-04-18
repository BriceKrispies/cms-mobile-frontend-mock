import { defineOnce, escapeHtml } from '../../utils/dom.js';

const styleUrl = new URL('./metric-card.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

// Light-DOM composite that renders itself inside a <ui-card>.
// Attributes: label, value, delta, tone (up|down|flat), footnote.
class MetricCard extends HTMLElement {
  static get observedAttributes() { return ['label', 'value', 'delta', 'tone', 'footnote']; }

  connectedCallback() { ensureStyle(); this._render(); }
  attributeChangedCallback() { if (this.isConnected) this._render(); }

  _render() {
    const label = escapeHtml(this.getAttribute('label') || '');
    const value = escapeHtml(this.getAttribute('value') || '—');
    const delta = this.getAttribute('delta');
    const tone = this.getAttribute('tone') || 'flat';
    const footnote = this.getAttribute('footnote');

    const arrow = tone === 'up' ? '▲' : tone === 'down' ? '▼' : '■';

    this.innerHTML = `
      <ui-card elevation="none">
        <div class="metric-card">
          <span class="metric-card__label">${label}</span>
          <span class="metric-card__value">${value}</span>
          ${delta != null ? `<span class="metric-card__delta" data-tone="${escapeHtml(tone)}">${arrow} ${escapeHtml(delta)}</span>` : ''}
          ${footnote ? `<span class="metric-card__footnote">${escapeHtml(footnote)}</span>` : ''}
        </div>
      </ui-card>
    `;
  }
}

defineOnce('metric-card', MetricCard);
export { MetricCard };
