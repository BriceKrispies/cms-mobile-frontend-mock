// Tiny pub/sub bus used by the app shell and features.

export function createBus() {
  const listeners = new Map();

  function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    listeners.get(event)?.delete(handler);
  }

  function emit(event, payload) {
    listeners.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(`[bus:${event}]`, err); }
    });
  }

  return { on, off, emit };
}

export const appBus = createBus();

export function dispatch(el, type, detail, opts = {}) {
  el.dispatchEvent(new CustomEvent(type, {
    detail,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...opts,
  }));
}
