import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';
import { navigate } from '../../app/router.js';

async function mount({ outlet }) {
  const scenarios = mockApi.listScenarios();
  const current = mockApi.getScenario();

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Admin"
      title="Settings"
      description="Developer tools for this mock frontend."></page-header>

    <ui-stack gap="4">
      <ui-card>
        <span slot="title">Mock scenario</span>
        <p class="u-text-muted u-text-sm">Switch the dataset the app sees without reloading.</p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top: var(--space-3)">
          ${scenarios.map((s) => `
            <ui-button
              data-scenario="${escapeHtml(s.id)}"
              variant="${s.id === current ? 'primary' : 'subtle'}">
              ${escapeHtml(s.label)}
            </ui-button>
          `).join('')}
        </div>
      </ui-card>

      <ui-card>
        <span slot="title">API simulation</span>
        <ui-stack gap="3">
          <ui-input label="Latency (ms)" type="number" value="250" id="set-latency" hint="Delay applied to every mock request."></ui-input>
          <ui-input label="Failure rate (0–1)" type="number" value="0" id="set-fail" hint="Probability that a mock request throws."></ui-input>
          <ui-stack direction="row" justify="end" gap="2">
            <ui-button variant="primary" id="set-apply">Apply</ui-button>
          </ui-stack>
        </ui-stack>
      </ui-card>
    </ui-stack>
  `;
  outlet.appendChild(wrap);

  wrap.querySelectorAll('[data-scenario]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mockApi.setScenario(btn.dataset.scenario);
      navigate('/settings');
    });
  });

  wrap.querySelector('#set-apply').addEventListener('click', () => {
    const latency = Number(wrap.querySelector('#set-latency').value) || 0;
    const fail = Number(wrap.querySelector('#set-fail').value) || 0;
    mockApi.setLatency(latency);
    mockApi.setFailRate(fail);
    alert(`Applied: latency=${latency}ms, failRate=${fail}`);
  });
}

export const routes = [{ path: '/settings', mount }];
