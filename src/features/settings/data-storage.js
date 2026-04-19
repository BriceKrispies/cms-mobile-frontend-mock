import { mockApi } from '../../mock-data/api/mockApi.js';
import { appBus } from '../../utils/events.js';

// Settings card: one-shot destructive actions for clearing persisted
// Message Board state (messages, reactions, replies). Mirrors the
// "Reset to defaults" pattern on the Appearance card — no stage-and-save,
// just a guarded button.
export function renderDataStorage(container) {
  let status = '';

  const draw = () => {
    container.innerHTML = `
      <ui-card>
        <span slot="title">Data &amp; storage</span>
        <p class="u-text-muted u-text-sm">
          The Message Board keeps every post, reaction, and reply in your browser so the feed
          survives a refresh. Use this to wipe all of that state and restore the seed messages.
        </p>

        <div slot="footer" class="settings-footer" data-dirty="false">
          <span class="settings-footer__status">${status || 'No action taken yet.'}</span>
          <ui-stack direction="row" gap="2" justify="end">
            <ui-button id="mb-clear" variant="danger">Clear message board data</ui-button>
          </ui-stack>
        </div>
      </ui-card>
    `;

    container.querySelector('#mb-clear').addEventListener('click', () => {
      const ok = confirm('Clear every message, reaction, and reply you have saved in this browser? Seed messages will be restored.');
      if (!ok) return;
      const { removed } = mockApi.resetMessages();
      status = removed
        ? `Cleared ${removed} stored message${removed === 1 ? '' : 's'} (including reactions and replies).`
        : 'Nothing to clear — storage was already empty.';
      draw();
    });
  };

  draw();

  const off = appBus.on('messages:change', (e) => {
    // If something else clears it (unlikely, but keep the card in sync).
    if (e?.action === 'reset') {
      status = `Cleared ${e.removed ?? 0} stored message${e.removed === 1 ? '' : 's'} (including reactions and replies).`;
      draw();
    }
  });
  return off;
}
