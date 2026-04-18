import { defineOnce, escapeHtml } from '../../utils/dom.js';

const styleUrl = new URL('./recognition-card.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

// Expects a .data property with:
// { id, from: {name, initials}, to: {name, initials}, message, values: [string], points, likes, when, status }
class RecognitionCard extends HTMLElement {
  connectedCallback() { ensureStyle(); this._render(); }
  set data(v) { this._data = v; if (this.isConnected) this._render(); }
  get data() { return this._data; }

  _render() {
    const d = this._data;
    if (!d) { this.innerHTML = ''; return; }

    const initials = (name) =>
      name?.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';

    const statusTone = { approved: 'success', pending: 'warning', rejected: 'danger' };

    const valuesHtml = (d.values || [])
      .map((v) => `<ui-badge tone="primary" size="sm">${escapeHtml(v)}</ui-badge>`).join('');

    this.innerHTML = `
      <ui-card>
        <div class="recognition">
          <div class="recognition__head">
            <div class="recognition__avatar" aria-hidden="true">${escapeHtml(initials(d.from?.name))}</div>
            <div class="recognition__who">
              <div class="recognition__from-to">
                <strong>${escapeHtml(d.from?.name || 'Someone')}</strong>
                <span class="u-text-muted"> recognized </span>
                <strong>${escapeHtml(d.to?.name || 'someone')}</strong>
              </div>
              <div class="recognition__meta">
                ${escapeHtml(d.when || '')}
                ${d.status ? ` • <ui-badge tone="${statusTone[d.status] ?? 'info'}" size="sm">${escapeHtml(d.status)}</ui-badge>` : ''}
              </div>
            </div>
          </div>
          <p class="recognition__message">${escapeHtml(d.message || '')}</p>
          ${valuesHtml ? `<div class="recognition__values">${valuesHtml}</div>` : ''}
          <div class="recognition__foot">
            ${d.points != null ? `<span class="recognition__foot-item">★ ${escapeHtml(d.points)} pts</span>` : ''}
            ${d.likes != null ? `<span class="recognition__foot-item">♥ ${escapeHtml(d.likes)}</span>` : ''}
          </div>
        </div>
      </ui-card>
    `;
  }
}

defineOnce('recognition-card', RecognitionCard);
export { RecognitionCard };
