// Shared chrome for /insights/* views — stylesheet injection, page-level
// tab strip, and a trend-chart renderer lifted from the dashboard.

import { escapeHtml } from '../../../utils/dom.js';

const styleUrl = new URL('../insights.css', import.meta.url).href;
let styleInjected = false;
export function ensureInsightsStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

// Page-level tab strip: two anchors styled as pills, active state
// derived from the current path. Not <ui-tabs> — that has its own
// local state that fights route-driven activation.
export function tabStripHtml(active /* 'reporting' | 'analytics' */) {
  const tab = (id, label, path) => `
    <a
      class="insights-tabs__link ${active === id ? 'is-active' : ''}"
      href="#${path}"
      data-tab="${escapeHtml(id)}">${escapeHtml(label)}</a>
  `;
  return `
    <nav class="insights-tabs" aria-label="Insights sections">
      ${tab('reporting', 'Reporting', '/insights/reporting')}
      ${tab('analytics', 'Analytics', '/insights/analytics')}
    </nav>
  `;
}

// Reusable horizontal bar chart. Values are normalized to the tallest bar.
export function renderTrend(el, data, { narrow = false, labelOf = (d) => d.label, valueOf = (d) => d.value } = {}) {
  if (!el) return;
  if (narrow) el.classList.add('insights-trend--narrow');
  else el.classList.remove('insights-trend--narrow');

  if (!data.length) {
    el.innerHTML = `<div class="insights-empty">No activity in this window.</div>`;
    return;
  }

  const max = Math.max(1, ...data.map((d) => valueOf(d)));
  el.innerHTML = data.map((d) => {
    const v = valueOf(d);
    const h = (v / max) * 100;
    return `
      <div class="insights-trend__bar" title="${escapeHtml(labelOf(d))}: ${escapeHtml(v)}">
        <div class="insights-trend__column" style="--_h: ${h}%" aria-hidden="true"></div>
        <div class="insights-trend__label">${escapeHtml(labelOf(d))}</div>
      </div>
    `;
  }).join('');
}

// Small formatting helpers shared across insights views.
export function formatDurationMs(ms) {
  if (!ms || ms < 1000) return `${Math.max(0, Math.round(ms ?? 0))}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

export function formatAbsoluteTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatClockTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}
