// Schema engine. Holds the in-memory field registry, applies seed +
// user overrides, and exposes CRUD + user validation. Pure logic —
// no DOM, no fixtures, no mock-data. Consumers (mockApi, UI, future
// group engine) call the exported functions.

import { TYPES, isKnownType, operatorsForType } from './types.js';
import { SEED_FIELDS } from './seed.js';
import { loadOverrides, saveOverrides, clearOverrides } from './storage.js';
import { appBus } from '../utils/events.js';

const ID_RE = /^[a-z][a-zA-Z0-9_]*$/;

const state = {
  fields: new Map(),
  initialized: false,
};

function ensureInit() {
  if (!state.initialized) initSchema();
}

function seedField(raw) {
  return {
    id: raw.id,
    label: raw.label,
    type: raw.type,
    description: raw.description ?? '',
    enumValues: raw.enumValues ? [...raw.enumValues] : undefined,
    min: raw.min ?? null,
    max: raw.max ?? null,
    source: 'seed',
    createdAt: null,
    updatedAt: null,
  };
}

function cleanIncomingUserField(raw, { allowExisting = false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null;
  if (!allowExisting && state.fields.has(raw.id)) return null;
  if (!isKnownType(raw.type)) return null;
  if (typeof raw.label !== 'string' || !raw.label.trim()) return null;

  const clean = {
    id: raw.id,
    label: raw.label.trim(),
    type: raw.type,
    description: typeof raw.description === 'string' ? raw.description : '',
    source: 'user',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (raw.type === 'string' && Array.isArray(raw.enumValues)) {
    const enums = raw.enumValues.filter((v) => typeof v === 'string' && v.length);
    if (enums.length) clean.enumValues = enums;
  }
  if (raw.type === 'number') {
    if (typeof raw.min === 'number' && Number.isFinite(raw.min)) clean.min = raw.min;
    if (typeof raw.max === 'number' && Number.isFinite(raw.max)) clean.max = raw.max;
  }

  return clean;
}

function applyPatch(field, patch) {
  const next = { ...field };
  if (typeof patch.label === 'string' && patch.label.trim()) next.label = patch.label.trim();
  if (typeof patch.description === 'string') next.description = patch.description;
  if (field.type === 'string' && Array.isArray(patch.enumValues)) {
    const enums = patch.enumValues.filter((v) => typeof v === 'string' && v.length);
    next.enumValues = enums.length ? enums : undefined;
  }
  if (field.type === 'number') {
    if (patch.min === null || typeof patch.min === 'number') next.min = patch.min ?? null;
    if (patch.max === null || typeof patch.max === 'number') next.max = patch.max ?? null;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

function diffSeedPatch(current, seed) {
  const patch = {};
  if (current.label !== seed.label) patch.label = current.label;
  if ((current.description ?? '') !== (seed.description ?? '')) patch.description = current.description;
  const aEnum = JSON.stringify(current.enumValues ?? null);
  const bEnum = JSON.stringify(seed.enumValues ?? null);
  if (aEnum !== bEnum) patch.enumValues = current.enumValues ?? null;
  return patch;
}

function persist() {
  const user = [];
  const patches = {};
  for (const field of state.fields.values()) {
    if (field.source === 'user') {
      user.push(field);
      continue;
    }
    const seed = SEED_FIELDS.find((s) => s.id === field.id);
    if (!seed) continue;
    const diff = diffSeedPatch(field, seed);
    if (Object.keys(diff).length) patches[field.id] = diff;
  }
  saveOverrides({ user, patches });
}

// -------------------- Public API --------------------

export function initSchema() {
  if (state.initialized) return;
  state.initialized = true;
  state.fields = new Map();

  for (const raw of SEED_FIELDS) {
    state.fields.set(raw.id, seedField(raw));
  }

  const overrides = loadOverrides();

  // Apply seed patches
  for (const [id, patch] of Object.entries(overrides.patches || {})) {
    const field = state.fields.get(id);
    if (!field || field.source !== 'seed') continue;
    try {
      state.fields.set(id, applyPatch(field, patch));
    } catch {
      // Ignore malformed patch — keep seed default.
    }
  }

  // Apply user-added fields
  for (const raw of overrides.user || []) {
    const clean = cleanIncomingUserField(raw);
    if (!clean) continue;
    if (SEED_FIELDS.some((s) => s.id === clean.id)) continue; // no shadowing
    state.fields.set(clean.id, clean);
  }
}

export function listFields() {
  ensureInit();
  return [...state.fields.values()].map((f) => ({ ...f }));
}

export function getField(id) {
  ensureInit();
  const f = state.fields.get(id);
  return f ? { ...f } : null;
}

export function createField(def) {
  ensureInit();
  const clean = cleanIncomingUserField(def);
  if (!clean) {
    throw new Error('Invalid field definition');
  }
  state.fields.set(clean.id, clean);
  persist();
  appBus.emit('schema:change', { action: 'create', id: clean.id });
  return { ...clean };
}

export function updateField(id, patch) {
  ensureInit();
  const existing = state.fields.get(id);
  if (!existing) throw new Error(`Field "${id}" not found`);
  const next = applyPatch(existing, patch || {});
  state.fields.set(id, next);
  persist();
  appBus.emit('schema:change', { action: 'update', id });
  return { ...next };
}

export function deleteField(id) {
  ensureInit();
  const existing = state.fields.get(id);
  if (!existing) return;
  if (existing.source === 'seed') {
    throw new Error('Seed fields cannot be deleted');
  }
  state.fields.delete(id);
  persist();
  appBus.emit('schema:change', { action: 'delete', id });
}

export function resetSchema() {
  clearOverrides();
  state.initialized = false;
  initSchema();
  appBus.emit('schema:change', { action: 'reset' });
}

export function coerceValue(fieldId, raw) {
  ensureInit();
  const field = state.fields.get(fieldId);
  if (!field) return null;
  const type = TYPES[field.type];
  if (!type) return null;
  return type.coerce(raw);
}

export function formatValue(fieldId, v) {
  ensureInit();
  const field = state.fields.get(fieldId);
  if (!field) return '';
  const type = TYPES[field.type];
  if (!type) return '';
  return type.format(v);
}

// Clean a user object against the schema. Unknown keys are dropped
// (with a debug log). Known keys get their values coerced; values that
// can't coerce are dropped. Enum constraints are enforced on read.
export function validateUser(user) {
  ensureInit();
  if (!user || typeof user !== 'object') return { id: null };
  const out = { id: user.id };
  for (const [key, raw] of Object.entries(user)) {
    if (key === 'id') continue;
    const field = state.fields.get(key);
    if (!field) {
      console.debug(`[schema] dropping unknown key "${key}" on user ${user.id}`);
      continue;
    }
    const type = TYPES[field.type];
    if (!type) continue;
    const coerced = type.coerce(raw);
    if (coerced == null) {
      if (raw != null) console.debug(`[schema] dropping uncoercible ${key}=${raw} on user ${user.id}`);
      continue;
    }
    if (field.type === 'string' && field.enumValues && !field.enumValues.includes(coerced)) {
      console.debug(`[schema] dropping out-of-enum ${key}="${coerced}" on user ${user.id}`);
      continue;
    }
    out[key] = coerced;
  }
  return out;
}

export { operatorsForType };

export function operatorsForField(fieldId) {
  ensureInit();
  const field = state.fields.get(fieldId);
  if (!field) return [];
  return operatorsForType(field.type);
}
