import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';
import { appBus } from '../../utils/events.js';
import { renderAppearance } from './appearance.js';

const styleUrl = new URL('./settings.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

async function mount({ outlet, signal }) {
  ensureStyle();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Admin"
      title="Settings"
      description="Developer tools for this mock frontend."></page-header>

    <ui-stack gap="4">
      <div id="appearance-slot"></div>
      <div id="scenario-slot"></div>
      <div id="api-slot"></div>
    </ui-stack>
  `;
  outlet.appendChild(wrap);

  const disposers = [];
  disposers.push(renderAppearance(wrap.querySelector('#appearance-slot')));
  disposers.push(renderScenario(wrap.querySelector('#scenario-slot')));
  disposers.push(renderApiSimulation(wrap.querySelector('#api-slot')));

  signal?.addEventListener('abort', () => disposers.forEach((fn) => fn?.()));
}

// --- Mock scenario card (stage-and-save) ----------------------------------

function renderScenario(container) {
  const scenarios = mockApi.listScenarios();
  let pending = mockApi.getScenario();

  const draw = () => {
    const applied = mockApi.getScenario();
    const dirty = pending !== applied;

    container.innerHTML = `
      <ui-card>
        <span slot="title">Mock scenario</span>
        <p class="u-text-muted u-text-sm">Switch the dataset the app sees.</p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-3)">
          ${scenarios.map((s) => `
            <ui-button
              size="sm"
              data-scenario="${escapeHtml(s.id)}"
              variant="${s.id === pending ? 'primary' : 'subtle'}">
              ${escapeHtml(s.label)}
            </ui-button>
          `).join('')}
        </div>

        <div slot="footer" class="settings-footer" data-dirty="${dirty}">
          <span class="settings-footer__status">
            ${dirty ? 'Scenario change is staged.' : `Current scenario: ${escapeHtml(applied)}.`}
          </span>
          <ui-stack direction="row" gap="2" justify="end">
            <ui-button id="scenario-discard" variant="ghost" ${dirty ? '' : 'disabled'}>Discard</ui-button>
            <ui-button id="scenario-save" variant="primary" ${dirty ? '' : 'disabled'}>Save changes</ui-button>
          </ui-stack>
        </div>
      </ui-card>
    `;

    container.querySelectorAll('ui-button[data-scenario]').forEach((btn) => {
      btn.addEventListener('click', () => {
        pending = btn.dataset.scenario;
        draw();
      });
    });

    container.querySelector('#scenario-discard').addEventListener('click', () => {
      pending = mockApi.getScenario();
      draw();
    });

    container.querySelector('#scenario-save').addEventListener('click', () => {
      mockApi.setScenario(pending);
      // The mock:scenario-changed listener below will redraw with fresh state.
    });
  };

  draw();

  const off = appBus.on('mock:scenario-changed', () => {
    pending = mockApi.getScenario();
    draw();
  });
  return off;
}

// --- API simulation card (stage-and-save on Save) -------------------------

function renderApiSimulation(container) {
  // Snapshot the currently-applied values. The mockApi module doesn't
  // expose getters for these, so we capture what we set as we go.
  const applied = { latency: 250, failRate: 0 };
  let pending = { ...applied };

  container.innerHTML = `
    <ui-card>
      <span slot="title">API simulation</span>
      <ui-stack gap="3">
        <ui-input
          label="Latency (ms)"
          type="number"
          value="${applied.latency}"
          id="set-latency"
          hint="Delay applied to every mock request."></ui-input>
        <ui-input
          label="Failure rate (0–1)"
          type="number"
          value="${applied.failRate}"
          id="set-fail"
          hint="Probability that a mock request throws."></ui-input>
      </ui-stack>

      <div slot="footer" class="settings-footer" data-dirty="false">
        <span class="settings-footer__status"></span>
        <ui-stack direction="row" gap="2" justify="end">
          <ui-button id="api-discard" variant="ghost" disabled>Discard</ui-button>
          <ui-button id="api-save" variant="primary" disabled>Save changes</ui-button>
        </ui-stack>
      </div>
    </ui-card>
  `;

  const latencyInput = container.querySelector('#set-latency');
  const failInput = container.querySelector('#set-fail');
  const footer = container.querySelector('.settings-footer');
  const status = container.querySelector('.settings-footer__status');
  const discardBtn = container.querySelector('#api-discard');
  const saveBtn = container.querySelector('#api-save');

  const updateFooter = () => {
    const dirty =
      pending.latency !== applied.latency || pending.failRate !== applied.failRate;
    footer.dataset.dirty = String(dirty);
    status.textContent = dirty
      ? 'Changes are staged.'
      : `Currently: ${applied.latency}ms latency, ${applied.failRate} failure rate.`;
    for (const btn of [discardBtn, saveBtn]) {
      if (dirty) btn.removeAttribute('disabled');
      else btn.setAttribute('disabled', '');
    }
  };

  latencyInput.addEventListener('input', (e) => {
    pending.latency = Number(e.detail?.value ?? latencyInput.value) || 0;
    updateFooter();
  });
  failInput.addEventListener('input', (e) => {
    pending.failRate = Math.min(
      1,
      Math.max(0, Number(e.detail?.value ?? failInput.value) || 0),
    );
    updateFooter();
  });

  discardBtn.addEventListener('click', () => {
    pending = { ...applied };
    latencyInput.value = pending.latency;
    failInput.value = pending.failRate;
    updateFooter();
  });

  saveBtn.addEventListener('click', () => {
    mockApi.setLatency(pending.latency);
    mockApi.setFailRate(pending.failRate);
    applied.latency = pending.latency;
    applied.failRate = pending.failRate;
    updateFooter();
  });

  updateFooter();
  return () => {};
}

export const routes = [{ path: '/settings', mount }];
