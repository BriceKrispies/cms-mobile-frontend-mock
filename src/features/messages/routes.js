import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';
import { navigate } from '../../app/router.js';
import { appBus } from '../../utils/events.js';

const styleUrl = new URL('./messages.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

const VIEWER_KEY = 'cms:messages:viewer';
const ID_RE = /^msg_[a-zA-Z0-9_]+$/;

function initials(name) {
  return name?.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';
}

function audienceBadge(source) {
  if (source === 'group-missing') return { tone: 'danger', label: 'Missing group' };
  if (source === 'adhoc') return { tone: 'warning', label: 'Custom' };
  if (source === 'legacy') return { tone: 'info', label: 'Legacy' };
  return { tone: 'primary', label: 'Group' };
}

// --- List ------------------------------------------------------------------

async function mountList({ outlet, signal }) {
  ensureStyle();

  const people = await mockApi.listPeople();
  if (signal?.aborted) return;

  let viewerId = '';
  try { viewerId = localStorage.getItem(VIEWER_KEY) || ''; } catch { /* ignore */ }
  if (!people.some((p) => p.id === viewerId)) viewerId = '';

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Broadcast"
      title="Message Board"
      description="Post messages to any audience defined by your groups. React, reply, or just listen.">
      <div slot="actions">
        <ui-button variant="primary" id="mb-new">New message</ui-button>
      </div>
    </page-header>

    <ui-card>
      <span slot="title">Viewing as</span>
      <p class="u-text-muted u-text-sm">
        Pick a person to see the board from their perspective. Messages only appear to authors and audience members.
      </p>
      <div class="mb-viewer">
        <select id="mb-viewer">
          <option value="">Everyone (show all messages)</option>
          ${people.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === viewerId ? 'selected' : ''}>${escapeHtml(p.name)} — ${escapeHtml(p.team ?? '')}</option>`).join('')}
        </select>
      </div>
    </ui-card>

    <div id="mb-feed-slot" style="margin-top: var(--space-4)"></div>
  `;
  outlet.appendChild(wrap);

  wrap.querySelector('#mb-new').addEventListener('click', () => navigate('/messages/new'));

  const viewerSelect = wrap.querySelector('#mb-viewer');
  viewerSelect.addEventListener('change', () => {
    viewerId = viewerSelect.value;
    try { localStorage.setItem(VIEWER_KEY, viewerId); } catch { /* ignore */ }
    renderFeed();
  });

  const feedSlot = wrap.querySelector('#mb-feed-slot');

  const renderFeed = async () => {
    feedSlot.innerHTML = '<div class="u-text-muted" style="padding: var(--space-4)">Loading…</div>';
    const rows = await mockApi.listMessages(viewerId ? { viewerId } : {});
    if (signal?.aborted) return;
    if (!rows.length) {
      feedSlot.innerHTML = `<ui-card><p class="u-text-muted">${viewerId ? 'No messages in this viewer\u2019s audiences yet.' : 'No messages posted yet. Click "New message" to start the conversation.'}</p></ui-card>`;
      return;
    }
    feedSlot.innerHTML = '';
    const stack = document.createElement('ui-stack');
    stack.setAttribute('gap', '4');
    for (const m of rows) {
      stack.appendChild(renderMessageCard(m, viewerId, people));
    }
    feedSlot.appendChild(stack);
  };

  await renderFeed();

  const off = [
    appBus.on('messages:change', renderFeed),
    appBus.on('groups:change', renderFeed),
    appBus.on('schema:change', renderFeed),
    appBus.on('mock:scenario-changed', renderFeed),
  ];
  signal?.addEventListener('abort', () => off.forEach((fn) => fn()));
}

function renderMessageCard(m, viewerId, people) {
  const card = document.createElement('ui-card');
  card.className = 'mb-card';
  const badge = audienceBadge(m.audience.source);
  const emojis = mockApi.listReactionEmojis();

  card.innerHTML = `
    <div slot="title" class="mb-card__title">
      <span class="mb-avatar" aria-hidden="true">${escapeHtml(initials(m.author.name))}</span>
      <div>
        <div class="mb-card__author">${escapeHtml(m.author.name)}</div>
        <div class="mb-card__meta">${escapeHtml(m.author.title ?? m.author.team ?? '')} · ${escapeHtml(m.when)}</div>
      </div>
    </div>
    <div slot="actions" class="mb-card__audience">
      <ui-badge tone="${badge.tone}" size="sm">${badge.label}</ui-badge>
      <span class="mb-card__audience-name">${escapeHtml(m.audience.name)}</span>
      <span class="mb-card__audience-count">${m.audience.count} ${m.audience.count === 1 ? 'person' : 'people'}</span>
    </div>

    <p class="mb-card__body">${escapeHtml(m.body)}</p>

    <div class="mb-reactions">
      ${emojis.map((e) => {
        const count = m.reactionTotals[e] ?? 0;
        const mine = !!viewerId && m.reactions.some((r) => r.userId === viewerId && r.emoji === e);
        return `
          <button
            type="button"
            class="mb-reaction ${mine ? 'is-mine' : ''}"
            data-emoji="${escapeHtml(e)}"
            ${viewerId ? '' : 'disabled title="Pick a viewer to react"'}
            aria-pressed="${mine}">
            <span class="mb-reaction__emoji">${e}</span>
            <span class="mb-reaction__count">${count}</span>
          </button>
        `;
      }).join('')}
    </div>

    <div class="mb-replies">
      ${m.replies.length ? m.replies.map((r) => `
        <div class="mb-reply" data-reply="${escapeHtml(r.id)}">
          <span class="mb-avatar mb-avatar--sm" aria-hidden="true">${escapeHtml(initials(r.author.name))}</span>
          <div class="mb-reply__body">
            <div class="mb-reply__head">
              <strong>${escapeHtml(r.author.name)}</strong>
              <span class="mb-reply__when">${escapeHtml(r.when)}</span>
              ${viewerId && r.authorId === viewerId ? `<button type="button" class="mb-reply__del" data-del-reply="${escapeHtml(r.id)}" title="Delete reply">×</button>` : ''}
            </div>
            <div>${escapeHtml(r.body)}</div>
          </div>
        </div>
      `).join('') : '<p class="u-text-muted u-text-sm mb-replies__empty">No replies yet.</p>'}
    </div>

    <div class="mb-reply-form" slot="footer">
      ${viewerId ? `
        <span class="mb-avatar mb-avatar--sm" aria-hidden="true">${escapeHtml(initials(people.find((p) => p.id === viewerId)?.name ?? ''))}</span>
        <input
          type="text"
          class="mb-reply-input"
          placeholder="Write a reply…"
          data-reply-for="${escapeHtml(m.id)}" />
        <ui-button size="sm" variant="primary" data-reply-submit="${escapeHtml(m.id)}">Post</ui-button>
      ` : `
        <span class="u-text-muted u-text-sm">Pick a viewer above to reply or react.</span>
      `}
    </div>
  `;

  card.querySelectorAll('[data-emoji]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!viewerId) return;
      const emoji = btn.dataset.emoji;
      const mine = m.reactions.some((r) => r.userId === viewerId && r.emoji === emoji);
      try {
        if (mine) mockApi.removeReaction(m.id, viewerId, emoji);
        else mockApi.addReaction(m.id, viewerId, emoji);
      } catch (err) {
        alert(`Could not react: ${err.message}`);
      }
    });
  });

  card.querySelectorAll('[data-del-reply]').forEach((btn) => {
    btn.addEventListener('click', () => {
      try { mockApi.deleteReply(m.id, btn.dataset.delReply); }
      catch (err) { alert(`Could not delete: ${err.message}`); }
    });
  });

  const replyInput = card.querySelector('.mb-reply-input');
  const replyBtn = card.querySelector('[data-reply-submit]');
  const postReply = () => {
    if (!replyInput || !viewerId) return;
    const body = replyInput.value;
    if (!body.trim()) return;
    try {
      mockApi.addReply(m.id, { authorId: viewerId, body });
      replyInput.value = '';
    } catch (err) {
      alert(`Could not post: ${err.message}`);
    }
  };
  replyBtn?.addEventListener('click', postReply);
  replyInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      postReply();
    }
  });

  return card;
}

// --- New (stage-and-save) --------------------------------------------------

async function mountNew({ outlet, signal }) {
  ensureStyle();
  const people = await mockApi.listPeople();
  if (signal?.aborted) return;

  const applied = {
    authorId: people[0]?.id ?? '',
    body: '',
    audience: { groupId: null },
  };
  let pending = structuredClone(applied);

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="New"
      title="Post a message"
      description="Pick an author, write a message, and choose an audience."></page-header>

    <div id="mb-form-slot"></div>
  `;
  outlet.appendChild(wrap);

  const slot = wrap.querySelector('#mb-form-slot');

  const isDirty = () => JSON.stringify(pending) !== JSON.stringify(applied);
  const validate = () => {
    const errs = {};
    if (!pending.authorId) errs.authorId = 'Pick an author.';
    if (!pending.body.trim()) errs.body = 'Write something first.';
    if (!pending.audience.groupId && !pending.audience.definition) errs.audience = 'Pick or build an audience.';
    return errs;
  };

  const draw = () => {
    const errs = validate();
    const dirty = isDirty();
    const canSave = dirty && !Object.keys(errs).length;

    slot.innerHTML = `
      <ui-card>
        <span slot="title">Compose</span>

        <ui-stack gap="4">
          <div>
            <div class="u-text-sm u-text-muted u-mb-2">Posting as</div>
            <select id="mb-author" class="mb-author-select">
              ${people.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === pending.authorId ? 'selected' : ''}>${escapeHtml(p.name)} — ${escapeHtml(p.title ?? p.team ?? '')}</option>`).join('')}
            </select>
            ${errs.authorId ? `<p class="mb-form__err">${escapeHtml(errs.authorId)}</p>` : ''}
          </div>

          <div>
            <div class="u-text-sm u-text-muted u-mb-2">Message</div>
            <textarea
              id="mb-body"
              class="mb-body-input"
              rows="5"
              placeholder="What would you like to share?">${escapeHtml(pending.body)}</textarea>
            ${errs.body ? `<p class="mb-form__err">${escapeHtml(errs.body)}</p>` : ''}
          </div>

          <div>
            <div class="u-text-sm u-text-muted u-mb-2">Audience</div>
            <div id="mb-audience-slot"></div>
            ${errs.audience ? `<p class="mb-form__err">${escapeHtml(errs.audience)}</p>` : ''}
          </div>
        </ui-stack>

        <div slot="footer" class="settings-footer" data-dirty="${dirty}">
          <span class="settings-footer__status">
            ${dirty ? (canSave ? 'You have unsaved changes.' : 'Fix the errors above to save.') : 'No changes yet.'}
          </span>
          <ui-stack direction="row" gap="2" justify="end">
            <ui-button id="mb-cancel" variant="ghost">${dirty ? 'Discard' : 'Back'}</ui-button>
            <ui-button id="mb-save" variant="primary" ${canSave ? '' : 'disabled'}>Post message</ui-button>
          </ui-stack>
        </div>
      </ui-card>
    `;

    slot.querySelector('#mb-author').addEventListener('change', (e) => {
      pending.authorId = e.target.value;
      draw();
    });
    const body = slot.querySelector('#mb-body');
    body.addEventListener('input', () => {
      pending.body = body.value;
      // Avoid redraw on every keystroke — just update the footer state.
      const errsNow = validate();
      const dirtyNow = isDirty();
      const footer = slot.querySelector('.settings-footer');
      const save = slot.querySelector('#mb-save');
      const cancel = slot.querySelector('#mb-cancel');
      const status = footer.querySelector('.settings-footer__status');
      footer.dataset.dirty = String(dirtyNow);
      const canSaveNow = dirtyNow && !Object.keys(errsNow).length;
      status.textContent = dirtyNow
        ? (canSaveNow ? 'You have unsaved changes.' : 'Fix the errors above to save.')
        : 'No changes yet.';
      cancel.textContent = dirtyNow ? 'Discard' : 'Back';
      if (canSaveNow) save.removeAttribute('disabled'); else save.setAttribute('disabled', '');
    });

    const picker = document.createElement('group-picker');
    picker.value = pending.audience;
    picker.addEventListener('change', (e) => {
      // The inner <select> also emits a native bubbling 'change' without detail;
      // ignore it and wait for the picker's own CustomEvent.
      if (!e.detail) return;
      pending.audience = e.detail.value;
      draw();
    });
    slot.querySelector('#mb-audience-slot').appendChild(picker);

    slot.querySelector('#mb-cancel').addEventListener('click', () => {
      if (isDirty()) { pending = structuredClone(applied); draw(); }
      else navigate('/messages');
    });

    slot.querySelector('#mb-save').addEventListener('click', () => {
      const errsNow = validate();
      if (Object.keys(errsNow).length) return;
      try {
        const id = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        if (!ID_RE.test(id)) throw new Error('Generated id is malformed');
        mockApi.createMessage({
          id,
          authorId: pending.authorId,
          body: pending.body,
          audienceGroupId: pending.audience.groupId ?? null,
          audienceDefinition: pending.audience.definition ?? null,
        });
        navigate('/messages');
      } catch (err) {
        alert(`Could not post: ${err.message}`);
      }
    });
  };

  draw();
}

export const routes = [
  { path: '/messages',     mount: mountList },
  { path: '/messages/new', mount: mountNew },
];
