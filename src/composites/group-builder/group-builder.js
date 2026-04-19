import { defineOnce, escapeHtml } from '../../utils/dom.js';
import { mockApi } from '../../mock-data/api/mockApi.js';
import { TYPES } from '../../schema/index.js';
import { operatorLabel } from '../../groups/index.js';
import { dispatch } from '../../utils/events.js';

const styleUrl = new URL('./group-builder.css', import.meta.url).href;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  document.head.appendChild(link);
}

// Path helpers for immutable tree updates. A path is an array of
// keys/indexes leading to a node inside this._def.
function getAt(root, path) {
  let node = root;
  for (const seg of path) node = node?.[seg];
  return node;
}

function setAt(root, path, value) {
  if (!path.length) return value;
  const [head, ...rest] = path;
  const cur = root;
  const next = Array.isArray(cur) ? cur.slice() : { ...cur };
  next[head] = setAt(cur[head], rest, value);
  return next;
}

function defaultRule(field) {
  if (!field) return { kind: 'rule', field: '', op: '', value: '' };
  const ops = mockApi.operatorsForField(field.id);
  const op = ops[0] || '';
  return { kind: 'rule', field: field.id, op, value: defaultValueFor(field, op) };
}

function defaultValueFor(field, op) {
  if (!field) return '';
  if (op === 'is_empty' || op === 'is_not_empty') return null;
  if (op === 'between') return field.type === 'number' ? [0, 0] : ['', ''];
  if (op === 'in' || op === 'not_in') return field.enumValues?.length ? [field.enumValues[0]] : [];
  if (op === 'within_last_days' || op === 'more_than_days_ago') return 30;
  if (field.type === 'number') return 0;
  if (field.enumValues?.length) return field.enumValues[0];
  return '';
}

// <group-builder> — emits 'change' on every mutation with detail.definition.
// Set .definition + .ownerId before connect (or via attributes / properties).
class GroupBuilder extends HTMLElement {
  constructor() {
    super();
    this._def = { kind: 'and', children: [] };
    this._ownerId = null;
  }

  connectedCallback() {
    ensureStyle();
    this.classList.add('group-builder');
    this._render();
  }

  set definition(d) {
    this._def = d && typeof d === 'object' ? structuredClone(d) : { kind: 'and', children: [] };
    if (this.isConnected) this._render();
  }
  get definition() { return structuredClone(this._def); }

  set ownerId(id) { this._ownerId = id || null; if (this.isConnected) this._render(); }
  get ownerId() { return this._ownerId; }

  _emit() {
    dispatch(this, 'change', { definition: structuredClone(this._def) });
  }

  _mutate(path, value) {
    this._def = setAt(this._def, path, value);
    this._render();
    this._emit();
  }

  _removeChildAt(parentPath, index) {
    const parent = getAt(this._def, parentPath);
    if (!parent || !Array.isArray(parent.children)) return;
    const next = parent.children.filter((_, i) => i !== index);
    this._mutate([...parentPath, 'children'], next);
  }

  _appendChild(parentPath, child) {
    const parent = getAt(this._def, parentPath);
    if (!parent) return;
    if (parent.kind === 'not') {
      // 'not' takes a single child — wrap in an OR if it already has one.
      if (parent.child) {
        const wrapped = parent.child.kind === 'or'
          ? { ...parent.child, children: [...parent.child.children, child] }
          : { kind: 'or', children: [parent.child, child] };
        this._mutate([...parentPath, 'child'], wrapped);
      } else {
        this._mutate([...parentPath, 'child'], child);
      }
      return;
    }
    const children = Array.isArray(parent.children) ? [...parent.children, child] : [child];
    this._mutate([...parentPath, 'children'], children);
  }

  _render() {
    this.innerHTML = '';
    this.appendChild(this._renderNode(this._def, [], 0, true));
  }

  _renderNode(node, path, depth, isRoot) {
    if (!node) return document.createTextNode('');
    if (node.kind === 'and' || node.kind === 'or') return this._renderCombinator(node, path, depth, isRoot);
    if (node.kind === 'not') return this._renderNot(node, path, depth, isRoot);
    if (node.kind === 'rule') return this._renderRule(node, path);
    if (node.kind === 'group') return this._renderGroupRef(node, path);
    if (node.kind === 'all') return this._renderLeaf('Everyone', path);
    if (node.kind === 'none') return this._renderLeaf('No one', path);
    return this._renderLeaf(`Unsupported node: ${node.kind}`, path);
  }

  _renderCombinator(node, path, depth, isRoot) {
    const wrap = document.createElement('div');
    wrap.className = `gb-box gb-box--${node.kind} gb-depth-${Math.min(depth, 3)}`;

    const head = document.createElement('div');
    head.className = 'gb-box__head';
    head.innerHTML = `
      <div class="gb-box__title">
        <span class="gb-box__chip">${node.kind === 'and' ? 'Match ALL of' : 'Match ANY of'}</span>
        <button type="button" class="gb-box__toggle" data-toggle aria-label="Switch combinator">
          ${node.kind === 'and' ? '↺ Switch to ANY' : '↺ Switch to ALL'}
        </button>
      </div>
    `;
    if (!isRoot) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'gb-box__remove';
      remove.setAttribute('aria-label', 'Remove this group');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        const parentPath = path.slice(0, -2);
        const lastKey = path[path.length - 2];
        if (lastKey === 'children') {
          const idx = path[path.length - 1];
          this._removeChildAt(parentPath, idx);
        } else if (lastKey === 'child') {
          this._mutate([...parentPath, 'child'], null);
        }
      });
      head.appendChild(remove);
    }
    wrap.appendChild(head);

    head.querySelector('[data-toggle]').addEventListener('click', () => {
      const next = node.kind === 'and' ? 'or' : 'and';
      this._mutate(path, { ...node, kind: next });
    });

    const list = document.createElement('div');
    list.className = 'gb-box__children';
    const children = Array.isArray(node.children) ? node.children : [];
    if (!children.length) {
      const empty = document.createElement('div');
      empty.className = 'gb-box__empty';
      empty.textContent = 'No conditions yet — add a rule or group below.';
      list.appendChild(empty);
    } else {
      children.forEach((child, i) => {
        list.appendChild(this._renderNode(child, [...path, 'children', i], depth + 1, false));
      });
    }
    wrap.appendChild(list);

    wrap.appendChild(this._renderAddRow(path));
    return wrap;
  }

  _renderNot(node, path, depth, isRoot) {
    const wrap = document.createElement('div');
    wrap.className = `gb-box gb-box--not gb-depth-${Math.min(depth, 3)}`;

    const head = document.createElement('div');
    head.className = 'gb-box__head';
    head.innerHTML = `
      <div class="gb-box__title">
        <span class="gb-box__chip gb-box__chip--exclude">Exclude anything matching</span>
      </div>
    `;
    if (!isRoot) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'gb-box__remove';
      remove.setAttribute('aria-label', 'Remove this exclusion');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        const parentPath = path.slice(0, -2);
        const lastKey = path[path.length - 2];
        if (lastKey === 'children') {
          this._removeChildAt(parentPath, path[path.length - 1]);
        } else if (lastKey === 'child') {
          this._mutate([...parentPath, 'child'], null);
        }
      });
      head.appendChild(remove);
    }
    wrap.appendChild(head);

    const inner = document.createElement('div');
    inner.className = 'gb-box__children';
    if (!node.child) {
      const empty = document.createElement('div');
      empty.className = 'gb-box__empty';
      empty.textContent = 'Nothing to exclude yet — add a rule or group below.';
      inner.appendChild(empty);
    } else {
      inner.appendChild(this._renderNode(node.child, [...path, 'child'], depth + 1, false));
    }
    wrap.appendChild(inner);

    wrap.appendChild(this._renderAddRow(path));
    return wrap;
  }

  _renderRule(node, path) {
    const row = document.createElement('div');
    row.className = 'gb-row gb-row--rule';

    const fields = mockApi.listFields();
    const field = fields.find((f) => f.id === node.field) || null;
    const ops = field ? mockApi.operatorsForField(field.id) : [];

    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'gb-select';
    fieldSelect.innerHTML = `
      <option value="" ${field ? '' : 'selected'} disabled>Pick a field…</option>
      ${fields.map((f) => `<option value="${escapeHtml(f.id)}" ${f.id === node.field ? 'selected' : ''}>${escapeHtml(f.label)}</option>`).join('')}
    `;
    fieldSelect.addEventListener('change', () => {
      const next = fields.find((f) => f.id === fieldSelect.value);
      if (!next) return;
      const newOps = mockApi.operatorsForField(next.id);
      const op = newOps.includes(node.op) ? node.op : (newOps[0] || '');
      this._mutate(path, {
        kind: 'rule',
        field: next.id,
        op,
        value: defaultValueFor(next, op),
      });
    });
    row.appendChild(fieldSelect);

    const opSelect = document.createElement('select');
    opSelect.className = 'gb-select';
    opSelect.disabled = !field;
    opSelect.innerHTML = `
      ${field ? '' : '<option value="" selected disabled>—</option>'}
      ${ops.map((o) => `<option value="${escapeHtml(o)}" ${o === node.op ? 'selected' : ''}>${escapeHtml(operatorLabel(o))}</option>`).join('')}
    `;
    opSelect.addEventListener('change', () => {
      const op = opSelect.value;
      this._mutate(path, { ...node, op, value: defaultValueFor(field, op) });
    });
    row.appendChild(opSelect);

    row.appendChild(this._renderValueWidget(node, field, path));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'gb-row__remove';
    remove.setAttribute('aria-label', 'Remove rule');
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      const parentPath = path.slice(0, -2);
      const idx = path[path.length - 1];
      const lastKey = path[path.length - 2];
      if (lastKey === 'children') this._removeChildAt(parentPath, idx);
      else if (lastKey === 'child') this._mutate([...parentPath, 'child'], null);
    });
    row.appendChild(remove);

    return row;
  }

  _renderValueWidget(node, field, path) {
    const wrap = document.createElement('span');
    wrap.className = 'gb-value';
    if (!field || !node.op) {
      wrap.innerHTML = '<span class="gb-value__hint">—</span>';
      return wrap;
    }
    const op = node.op;
    if (op === 'is_empty' || op === 'is_not_empty') {
      wrap.innerHTML = '<span class="gb-value__hint">(no value)</span>';
      return wrap;
    }

    const setValue = (v) => this._mutate([...path, 'value'], v);

    if (op === 'in' || op === 'not_in') {
      const list = Array.isArray(node.value) ? node.value : [];
      const hint = field.enumValues?.length ? '' : 'Comma-separated';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'gb-input';
      input.value = list.join(', ');
      input.placeholder = hint;
      input.addEventListener('input', () => {
        const arr = input.value.split(',').map((s) => s.trim()).filter(Boolean);
        setValue(arr);
      });
      wrap.appendChild(input);
      return wrap;
    }

    if (op === 'between') {
      const [from, to] = Array.isArray(node.value) ? node.value : [null, null];
      const inputType = field.type === 'number' ? 'number'
        : field.type === 'date' ? 'date'
        : field.type === 'timestamp' ? 'datetime-local'
        : 'text';

      const fromEl = document.createElement('input');
      fromEl.type = inputType;
      fromEl.className = 'gb-input gb-input--small';
      fromEl.value = from ?? '';
      fromEl.addEventListener('input', () => {
        setValue([
          field.type === 'number' ? Number(fromEl.value) : fromEl.value,
          to ?? '',
        ]);
      });
      const sep = document.createElement('span');
      sep.className = 'gb-value__sep';
      sep.textContent = 'to';
      const toEl = document.createElement('input');
      toEl.type = inputType;
      toEl.className = 'gb-input gb-input--small';
      toEl.value = to ?? '';
      toEl.addEventListener('input', () => {
        setValue([
          from ?? '',
          field.type === 'number' ? Number(toEl.value) : toEl.value,
        ]);
      });
      wrap.appendChild(fromEl);
      wrap.appendChild(sep);
      wrap.appendChild(toEl);
      return wrap;
    }

    if (op === 'within_last_days' || op === 'more_than_days_ago') {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.className = 'gb-input gb-input--small';
      input.value = String(node.value ?? 30);
      input.addEventListener('input', () => setValue(Number(input.value)));
      wrap.appendChild(input);
      const tail = document.createElement('span');
      tail.className = 'gb-value__hint';
      tail.textContent = 'days';
      wrap.appendChild(tail);
      return wrap;
    }

    if (field.enumValues?.length && (op === 'equals' || op === 'not_equals')) {
      const select = document.createElement('select');
      select.className = 'gb-select';
      select.innerHTML = field.enumValues.map((v) =>
        `<option value="${escapeHtml(v)}" ${v === node.value ? 'selected' : ''}>${escapeHtml(v)}</option>`
      ).join('');
      select.addEventListener('change', () => setValue(select.value));
      wrap.appendChild(select);
      return wrap;
    }

    const inputType = field.type === 'number' ? 'number'
      : field.type === 'date' ? 'date'
      : field.type === 'timestamp' ? 'datetime-local'
      : 'text';

    const input = document.createElement('input');
    input.type = inputType;
    input.className = 'gb-input';
    input.value = node.value ?? '';
    if (op === 'regex') input.placeholder = 'JS regex (case-insensitive)';
    input.addEventListener('input', () => {
      const v = field.type === 'number' ? Number(input.value) : input.value;
      setValue(v);
    });
    wrap.appendChild(input);
    return wrap;
  }

  _renderGroupRef(node, path) {
    const row = document.createElement('div');
    row.className = 'gb-row gb-row--group';

    const all = mockApi.listGroups();
    const eligible = all.filter((g) => g.id !== this._ownerId);

    const label = document.createElement('span');
    label.className = 'gb-row__label';
    label.textContent = 'Members of';
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'gb-select';
    select.innerHTML = `
      <option value="" ${node.id ? '' : 'selected'} disabled>Pick a group…</option>
      ${eligible.map((g) => `<option value="${escapeHtml(g.id)}" ${g.id === node.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
    `;
    select.addEventListener('change', () => {
      this._mutate(path, { kind: 'group', id: select.value });
    });
    row.appendChild(select);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'gb-row__remove';
    remove.setAttribute('aria-label', 'Remove group reference');
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      const parentPath = path.slice(0, -2);
      const lastKey = path[path.length - 2];
      if (lastKey === 'children') this._removeChildAt(parentPath, path[path.length - 1]);
      else if (lastKey === 'child') this._mutate([...parentPath, 'child'], null);
    });
    row.appendChild(remove);

    return row;
  }

  _renderLeaf(label, path) {
    const row = document.createElement('div');
    row.className = 'gb-row gb-row--leaf';
    row.innerHTML = `<span class="gb-row__label">${escapeHtml(label)}</span>`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'gb-row__remove';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      const parentPath = path.slice(0, -2);
      const lastKey = path[path.length - 2];
      if (lastKey === 'children') this._removeChildAt(parentPath, path[path.length - 1]);
      else if (lastKey === 'child') this._mutate([...parentPath, 'child'], null);
    });
    row.appendChild(remove);
    return row;
  }

  _renderAddRow(parentPath) {
    const row = document.createElement('div');
    row.className = 'gb-add';
    const fields = mockApi.listFields();
    const groups = mockApi.listGroups().filter((g) => g.id !== this._ownerId);

    const ruleBtn = document.createElement('button');
    ruleBtn.type = 'button';
    ruleBtn.className = 'gb-add__btn';
    ruleBtn.textContent = '+ Rule';
    ruleBtn.disabled = !fields.length;
    ruleBtn.addEventListener('click', () => {
      this._appendChild(parentPath, defaultRule(fields[0]));
    });

    const groupBtn = document.createElement('button');
    groupBtn.type = 'button';
    groupBtn.className = 'gb-add__btn';
    groupBtn.textContent = '+ Group';
    groupBtn.disabled = !groups.length;
    groupBtn.addEventListener('click', () => {
      this._appendChild(parentPath, { kind: 'group', id: groups[0].id });
    });

    const anyBtn = document.createElement('button');
    anyBtn.type = 'button';
    anyBtn.className = 'gb-add__btn';
    anyBtn.textContent = '+ Nested ANY';
    anyBtn.addEventListener('click', () => {
      this._appendChild(parentPath, { kind: 'or', children: [] });
    });

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'gb-add__btn';
    allBtn.textContent = '+ Nested ALL';
    allBtn.addEventListener('click', () => {
      this._appendChild(parentPath, { kind: 'and', children: [] });
    });

    const notBtn = document.createElement('button');
    notBtn.type = 'button';
    notBtn.className = 'gb-add__btn';
    notBtn.textContent = '+ Exclude';
    notBtn.addEventListener('click', () => {
      this._appendChild(parentPath, { kind: 'not', child: null });
    });

    row.append(ruleBtn, groupBtn, anyBtn, allBtn, notBtn);
    return row;
  }
}

defineOnce('group-builder', GroupBuilder);
export { GroupBuilder };
