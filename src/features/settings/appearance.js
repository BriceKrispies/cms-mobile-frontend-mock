import { escapeHtml } from '../../utils/dom.js';
import { listAxes, getTheme, setTheme } from '../../theme/theme.js';
import { appBus } from '../../utils/events.js';

// Appearance card with stage-and-save UX. Option clicks update local
// pending state; nothing applies globally until the user clicks Save.
export function renderAppearance(container) {
  const axes = listAxes();
  const defaults = Object.fromEntries(axes.map((a) => [a.id, a.default]));
  let pending = getTheme();

  const isDirty = () => {
    const applied = getTheme();
    return axes.some((axis) => pending[axis.id] !== applied[axis.id]);
  };

  const draw = () => {
    const dirty = isDirty();

    container.innerHTML = `
      <ui-card>
        <span slot="title">Appearance</span>
        <ui-button slot="actions" variant="ghost" id="theme-reset" size="sm">Reset to defaults</ui-button>

        <p class="u-text-muted u-text-sm">
          Tune the look and feel. Selections are staged — nothing changes until you save.
        </p>

        <ui-stack gap="4">
          ${axes.map((axis) => `
            <div class="appearance-axis">
              <div class="appearance-axis__label">${escapeHtml(axis.label)}</div>
              <div class="appearance-axis__options" data-axis="${escapeHtml(axis.id)}">
                ${axis.options.map((opt) => `
                  <ui-button
                    size="sm"
                    variant="${opt.id === pending[axis.id] ? 'primary' : 'subtle'}"
                    data-option="${escapeHtml(opt.id)}">
                    ${escapeHtml(opt.label)}
                  </ui-button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </ui-stack>

        <div slot="footer" class="appearance-footer" data-dirty="${dirty}">
          <span class="appearance-footer__status">
            ${dirty ? 'You have unsaved changes.' : 'All changes saved.'}
          </span>
          <ui-stack direction="row" gap="2" justify="end">
            <ui-button id="theme-discard" variant="ghost" ${dirty ? '' : 'disabled'}>Discard</ui-button>
            <ui-button id="theme-save" variant="primary" ${dirty ? '' : 'disabled'}>Save changes</ui-button>
          </ui-stack>
        </div>
      </ui-card>
    `;

    container.querySelectorAll('.appearance-axis__options').forEach((row) => {
      const axisId = row.dataset.axis;
      row.querySelectorAll('ui-button[data-option]').forEach((btn) => {
        btn.addEventListener('click', () => {
          pending = { ...pending, [axisId]: btn.dataset.option };
          draw();
        });
      });
    });

    container.querySelector('#theme-reset').addEventListener('click', () => {
      pending = { ...defaults };
      draw();
    });

    container.querySelector('#theme-discard').addEventListener('click', () => {
      pending = getTheme();
      draw();
    });

    container.querySelector('#theme-save').addEventListener('click', () => {
      setTheme(pending);
      // After setTheme emits theme:change, the sync listener below redraws
      // with the new applied state (dirty -> false). Nothing else to do.
    });
  };

  draw();

  // If the theme is changed elsewhere, reconcile pending with the new
  // applied state so the card doesn't show phantom dirty state.
  const off = appBus.on('theme:change', () => {
    pending = getTheme();
    draw();
  });

  return off;
}
