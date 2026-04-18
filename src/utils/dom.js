// Small DOM helpers. Intentionally tiny; do not let this grow into a framework.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) el.dataset[dk] = dv;
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in el && key !== 'list') {
      try { el[key] = value; } catch { el.setAttribute(key, String(value)); }
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  appendChildren(el, children);
  return el;
}

export function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(parent, node) {
  clear(parent);
  parent.appendChild(node);
  return node;
}

export function defineOnce(tag, ctor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

export function shadow(host, mode = 'open') {
  return host.shadowRoot || host.attachShadow({ mode });
}

export function html(strings, ...values) {
  // Minimal tagged template helper returning a DocumentFragment.
  // Not a safe HTML sanitizer — values are coerced to strings.
  const tpl = document.createElement('template');
  tpl.innerHTML = strings.reduce(
    (acc, s, i) => acc + s + (i < values.length ? escapeHtml(values[i]) : ''),
    ''
  );
  return tpl.content.cloneNode(true);
}

export function escapeHtml(v) {
  if (v == null) return '';
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
