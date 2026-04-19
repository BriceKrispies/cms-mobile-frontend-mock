// Group registry. Holds the in-memory map (seed + user overrides),
// applies seed patches, exposes CRUD, emits change events. Mirrors
// /src/schema/schema.js for consistency. Resolution itself lives in
// engine.js — this module just stores definitions.

import { SEED_GROUPS } from './seed.js';
import { loadOverrides, saveOverrides, clearOverrides } from './storage.js';
import { validateDefinition } from './validate.js';
import { resolveDefinition } from './engine.js';
import { appBus } from '../utils/events.js';

const ID_RE = /^[a-z][a-zA-Z0-9_]*$/;

const state = { groups: new Map(), initialized: false };

function ensureInit() {
  if (!state.initialized) initGroups();
}

function seedGroup(raw) {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    definition: raw.definition,
    source: 'seed',
    createdAt: null,
    updatedAt: null,
  };
}

function cleanIncoming(raw, { allowExisting = false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null;
  if (!allowExisting && state.groups.has(raw.id)) return null;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (!raw.definition || typeof raw.definition !== 'object') return null;
  return {
    id: raw.id,
    name: raw.name.trim(),
    description: typeof raw.description === 'string' ? raw.description : '',
    definition: raw.definition,
    source: 'user',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function applyPatch(group, patch) {
  const next = { ...group };
  if (typeof patch.name === 'string' && patch.name.trim()) next.name = patch.name.trim();
  if (typeof patch.description === 'string') next.description = patch.description;
  if (group.source === 'user' && patch.definition && typeof patch.definition === 'object') {
    next.definition = patch.definition;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

function diffSeedPatch(current, seed) {
  const patch = {};
  if (current.name !== seed.name) patch.name = current.name;
  if ((current.description ?? '') !== (seed.description ?? '')) patch.description = current.description;
  return patch;
}

function persist() {
  const user = [];
  const patches = {};
  for (const g of state.groups.values()) {
    if (g.source === 'user') {
      user.push(g);
      continue;
    }
    const seed = SEED_GROUPS.find((s) => s.id === g.id);
    if (!seed) continue;
    const diff = diffSeedPatch(g, seed);
    if (Object.keys(diff).length) patches[g.id] = diff;
  }
  saveOverrides({ user, patches });
}

// -------------------- Public API --------------------

export function initGroups() {
  if (state.initialized) return;
  state.initialized = true;
  state.groups = new Map();

  for (const raw of SEED_GROUPS) state.groups.set(raw.id, seedGroup(raw));

  const overrides = loadOverrides();

  for (const [id, patch] of Object.entries(overrides.patches || {})) {
    const g = state.groups.get(id);
    if (!g || g.source !== 'seed') continue;
    try { state.groups.set(id, applyPatch(g, patch)); }
    catch { /* keep seed default */ }
  }

  for (const raw of overrides.user || []) {
    const clean = cleanIncoming(raw);
    if (!clean) continue;
    if (SEED_GROUPS.some((s) => s.id === clean.id)) continue;
    state.groups.set(clean.id, clean);
  }
}

export function listGroups() {
  ensureInit();
  return [...state.groups.values()].map((g) => ({ ...g }));
}

export function getGroup(id) {
  ensureInit();
  const g = state.groups.get(id);
  return g ? { ...g } : null;
}

export function createGroup(def) {
  ensureInit();
  const clean = cleanIncoming(def);
  if (!clean) throw new Error('Invalid group definition');
  state.groups.set(clean.id, clean);
  persist();
  appBus.emit('groups:change', { action: 'create', id: clean.id });
  return { ...clean };
}

export function updateGroup(id, patch) {
  ensureInit();
  const existing = state.groups.get(id);
  if (!existing) throw new Error(`Group "${id}" not found`);
  if (existing.source === 'seed' && patch.definition) {
    throw new Error('Seed group definitions cannot be changed');
  }
  const next = applyPatch(existing, patch || {});
  state.groups.set(id, next);
  persist();
  appBus.emit('groups:change', { action: 'update', id });
  return { ...next };
}

export function deleteGroup(id) {
  ensureInit();
  const existing = state.groups.get(id);
  if (!existing) return;
  if (existing.source === 'seed') {
    throw new Error('Seed groups cannot be deleted');
  }
  state.groups.delete(id);
  persist();
  appBus.emit('groups:change', { action: 'delete', id });
}

export function resetGroups() {
  clearOverrides();
  state.initialized = false;
  initGroups();
  appBus.emit('groups:change', { action: 'reset' });
}

// Resolution wrappers — both take a `users` snapshot from the caller
// (mockApi). Validation is structural; cycle detection happens at
// resolve time. For preview, the caller can pass a definition that's
// not yet saved.

export function resolveGroup(id, users) {
  ensureInit();
  const groups = listGroups();
  return resolveDefinition({ kind: 'group', id }, { users, groups });
}

export function previewDefinition(definition, users, { ownerId } = {}) {
  ensureInit();
  const validation = validateDefinition(definition, { ownerId });
  if (validation.length) {
    return { ids: new Set(), errors: validation.map((e) => `${e.path}: ${e.message}`) };
  }
  const groups = listGroups();
  return resolveDefinition(definition, { users, groups });
}

export { validateDefinition };
