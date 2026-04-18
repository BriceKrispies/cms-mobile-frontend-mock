// Feature registry. Features self-register their routes + nav metadata.
// The app shell reads this to build navigation and dispatch routes.

import { appBus } from '../utils/events.js';

const features = new Map();

export function registerFeature(feature) {
  if (!feature || !feature.id) {
    throw new Error('registerFeature: feature.id is required');
  }
  if (features.has(feature.id)) {
    console.warn(`[registry] feature "${feature.id}" already registered; overwriting`);
  }
  features.set(feature.id, {
    id: feature.id,
    routes: feature.routes ?? [],
    nav: feature.nav ?? null,
    mount: feature.mount ?? (() => {}),
    unmount: feature.unmount ?? (() => {}),
  });
  appBus.emit('nav:updated', { id: feature.id });
}

export function getFeatures() {
  return [...features.values()];
}

export function getNavItems() {
  return getFeatures()
    .map((f) => f.nav)
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function getRoutes() {
  const all = [];
  for (const f of features.values()) {
    for (const route of f.routes) {
      all.push({ ...route, featureId: f.id, mount: route.mount ?? f.mount });
    }
  }
  return all;
}

export function findFeature(id) {
  return features.get(id) ?? null;
}
