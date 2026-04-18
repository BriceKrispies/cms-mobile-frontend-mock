// Shared helpers for shadow-DOM primitives. Keeps each component file small.

export function attachStylesheet(shadowRoot, cssUrl) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  shadowRoot.appendChild(link);
  return link;
}

export function reflectAttr(el, name, value) {
  if (value == null || value === false) el.removeAttribute(name);
  else if (value === true) el.setAttribute(name, '');
  else el.setAttribute(name, String(value));
}
