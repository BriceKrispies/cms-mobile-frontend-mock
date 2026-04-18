import { escapeHtml } from '../../utils/dom.js';
import { listAxes, getTheme, setTheme, resetTheme } from '../../theme/theme.js';
import { appBus } from '../../utils/events.js';

// Renders the Appearance card into the given container, wires up all
// axis buttons, and re-renders on theme changes from any source.
export function renderAppearance(container) {
  const draw = () => {
    const theme = getTheme();
    const axes = listAxes();

    container.innerHTML = `
      <ui-card>
        <span slot="title">Appearance</span>
        <ui-button slot="actions" variant="ghost" id="theme-reset">Reset</ui-button>

        <p class="u-text-muted u-text-sm">
          Tune the look and feel. Choices persist across reloads.
        </p>

        <ui-stack gap="4">
          ${axes.map((axis) => `
            <div class="appearance-axis">
              <div class="appearance-axis__label">${escapeHtml(axis.label)}</div>
              <div class="appearance-axis__options" data-axis="${escapeHtml(axis.id)}">
                ${axis.options.map((opt) => `
                  <ui-button
                    size="sm"
                    variant="${opt.id === theme[axis.id] ? 'primary' : 'subtle'}"
                    data-option="${escapeHtml(opt.id)}">
                    ${escapeHtml(opt.label)}
                  </ui-button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </ui-stack>
      </ui-card>
    `;

    container.querySelectorAll('.appearance-axis__options').forEach((row) => {
      const axisId = row.dataset.axis;
      row.querySelectorAll('ui-button[data-option]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTheme({ [axisId]: btn.dataset.option });
        });
      });
    });

    container.querySelector('#theme-reset').addEventListener('click', () => {
      resetTheme();
    });
  };

  draw();

  const off = appBus.on('theme:change', draw);

  // Return a disposer the caller can invoke on unmount.
  return off;
}
