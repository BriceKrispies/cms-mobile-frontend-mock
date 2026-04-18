// Minimal reactive store. Not a framework — just enough for features.

export function createStore(initial = {}) {
  let state = { ...initial };
  const subs = new Set();

  function get() { return state; }

  function set(patch) {
    const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
    if (next === state) return;
    state = next;
    subs.forEach((fn) => { try { fn(state); } catch (err) { console.error(err); } });
  }

  function subscribe(fn) {
    subs.add(fn);
    fn(state);
    return () => subs.delete(fn);
  }

  return { get, set, subscribe };
}
