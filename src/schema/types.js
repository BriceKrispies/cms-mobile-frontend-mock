// Primitive type registry. Each type knows how to validate, coerce,
// format values, and which operators apply to it. Adding a new type
// means adding one entry here and handling it in UI widgets.

const STRING_OPS = [
  'equals', 'not_equals',
  'contains', 'starts_with', 'ends_with', 'regex',
  'in', 'not_in',
  'is_empty', 'is_not_empty',
];

const NUMBER_OPS = [
  'eq', 'neq',
  'gt', 'gte', 'lt', 'lte',
  'between',
  'is_empty', 'is_not_empty',
];

const DATE_OPS = [
  'equals', 'not_equals',
  'before', 'after',
  'between',
  'within_last_days', 'more_than_days_ago',
  'is_empty', 'is_not_empty',
];

const TIMESTAMP_OPS = [
  'before', 'after',
  'between',
  'within_last_days', 'more_than_days_ago',
  'is_empty', 'is_not_empty',
];

export const TYPES = {
  string: {
    label: 'String',
    validate: (v) => typeof v === 'string',
    coerce: (raw) => {
      if (raw == null) return null;
      if (typeof raw === 'string') return raw;
      return String(raw);
    },
    format: (v) => (v == null ? '' : String(v)),
    operators: STRING_OPS,
  },

  number: {
    label: 'Number',
    validate: (v) => typeof v === 'number' && Number.isFinite(v),
    coerce: (raw) => {
      if (raw === '' || raw == null) return null;
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    },
    format: (v) => (v == null ? '' : String(v)),
    operators: NUMBER_OPS,
  },

  date: {
    label: 'Date',
    // Normalized form is YYYY-MM-DD, no timezone.
    validate: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v),
    coerce: (raw) => {
      if (!raw) return null;
      if (typeof raw !== 'string' && !(raw instanceof Date)) return null;
      const s = raw instanceof Date ? raw.toISOString() : String(raw);
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      if (!m) return null;
      // Validate it's a real date.
      const d = new Date(m[1] + 'T00:00:00Z');
      return Number.isFinite(d.getTime()) ? m[1] : null;
    },
    format: (v) => (v == null ? '' : String(v)),
    operators: DATE_OPS,
  },

  timestamp: {
    label: 'Timestamp',
    validate: (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)),
    coerce: (raw) => {
      if (!raw) return null;
      const t = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
      if (!Number.isFinite(t)) return null;
      return new Date(t).toISOString();
    },
    format: (v) => (v == null ? '' : String(v)),
    operators: TIMESTAMP_OPS,
  },
};

export const TYPE_IDS = Object.keys(TYPES);

export function isKnownType(t) {
  return typeof t === 'string' && t in TYPES;
}

export function operatorsForType(type) {
  return TYPES[type]?.operators ?? [];
}
