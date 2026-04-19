// Per-type operator predicates. Each returns boolean. Inputs are
// already coerced by the caller — userValue comes from the schema-
// validated user document, ruleValue is whatever the rule node carries.
// Missing values follow consistent rules:
//   - is_empty / is_not_empty inspect presence
//   - every other operator returns false when the user value is absent

import { coerceValue } from '../schema/index.js';

const isEmpty = (v) => v == null || v === '';

function ciEq(a, b) {
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

function ciStr(v) {
  return String(v ?? '').toLowerCase();
}

const STRING = {
  equals: (a, b, { caseSensitive }) => caseSensitive ? a === b : ciEq(a, b),
  not_equals: (a, b, opts) => !STRING.equals(a, b, opts),
  contains: (a, b, { caseSensitive }) => {
    if (a == null || b == null) return false;
    return caseSensitive ? String(a).includes(String(b)) : ciStr(a).includes(ciStr(b));
  },
  starts_with: (a, b, { caseSensitive }) => {
    if (a == null || b == null) return false;
    return caseSensitive ? String(a).startsWith(String(b)) : ciStr(a).startsWith(ciStr(b));
  },
  ends_with: (a, b, { caseSensitive }) => {
    if (a == null || b == null) return false;
    return caseSensitive ? String(a).endsWith(String(b)) : ciStr(a).endsWith(ciStr(b));
  },
  regex: (a, b, { caseSensitive }) => {
    if (a == null || typeof b !== 'string') return false;
    try {
      const re = new RegExp(b, caseSensitive ? '' : 'i');
      return re.test(String(a));
    } catch {
      return false;
    }
  },
  in: (a, b, { caseSensitive }) => {
    if (!Array.isArray(b)) return false;
    return caseSensitive
      ? b.some((x) => x === a)
      : b.some((x) => ciEq(x, a));
  },
  not_in: (a, b, opts) => !STRING.in(a, b, opts),
  is_empty: (a) => isEmpty(a),
  is_not_empty: (a) => !isEmpty(a),
};

const NUMBER = {
  eq:  (a, b) => Number(a) === Number(b),
  neq: (a, b) => Number(a) !== Number(b),
  gt:  (a, b) => a != null && Number(a) >  Number(b),
  gte: (a, b) => a != null && Number(a) >= Number(b),
  lt:  (a, b) => a != null && Number(a) <  Number(b),
  lte: (a, b) => a != null && Number(a) <= Number(b),
  between: (a, b) => {
    if (a == null || !Array.isArray(b) || b.length !== 2) return false;
    const [from, to] = b.map(Number);
    return Number(a) >= from && Number(a) <= to;
  },
  is_empty: (a) => isEmpty(a),
  is_not_empty: (a) => !isEmpty(a),
};

function dateMs(v) {
  if (!v) return NaN;
  const t = Date.parse(String(v).length === 10 ? v + 'T00:00:00Z' : v);
  return Number.isFinite(t) ? t : NaN;
}

const DATE = {
  equals: (a, b) => a != null && b != null && a === b,
  not_equals: (a, b) => a !== b,
  before: (a, b) => {
    const ta = dateMs(a), tb = dateMs(b);
    return Number.isFinite(ta) && Number.isFinite(tb) && ta < tb;
  },
  after: (a, b) => {
    const ta = dateMs(a), tb = dateMs(b);
    return Number.isFinite(ta) && Number.isFinite(tb) && ta > tb;
  },
  between: (a, b) => {
    if (!Array.isArray(b) || b.length !== 2) return false;
    const ta = dateMs(a), from = dateMs(b[0]), to = dateMs(b[1]);
    return Number.isFinite(ta) && Number.isFinite(from) && Number.isFinite(to) && ta >= from && ta <= to;
  },
  within_last_days: (a, b) => {
    const ta = dateMs(a);
    const days = Number(b);
    if (!Number.isFinite(ta) || !Number.isFinite(days)) return false;
    const now = Date.now();
    return ta >= now - days * 86400000 && ta <= now;
  },
  more_than_days_ago: (a, b) => {
    const ta = dateMs(a);
    const days = Number(b);
    if (!Number.isFinite(ta) || !Number.isFinite(days)) return false;
    return ta < Date.now() - days * 86400000;
  },
  is_empty: (a) => isEmpty(a),
  is_not_empty: (a) => !isEmpty(a),
};

const TIMESTAMP = {
  equals: DATE.equals,
  not_equals: DATE.not_equals,
  before: DATE.before,
  after: DATE.after,
  between: DATE.between,
  within_last_days: DATE.within_last_days,
  more_than_days_ago: DATE.more_than_days_ago,
  is_empty: (a) => isEmpty(a),
  is_not_empty: (a) => !isEmpty(a),
};

const HANDLERS = { string: STRING, number: NUMBER, date: DATE, timestamp: TIMESTAMP };

// Coerce the rule-side value to the field's type so both sides compare
// in the same shape. Arrays (for in / not_in / between) are mapped element-wise.
function coerceRuleValue(field, op, raw) {
  if (op === 'is_empty' || op === 'is_not_empty') return null;
  if (op === 'regex') return raw;
  if (op === 'in' || op === 'not_in') {
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => coerceValue(field.id, x)).filter((x) => x != null);
  }
  if (op === 'between') {
    if (!Array.isArray(raw) || raw.length !== 2) return [null, null];
    return [coerceValue(field.id, raw[0]), coerceValue(field.id, raw[1])];
  }
  if (op === 'within_last_days' || op === 'more_than_days_ago') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return coerceValue(field.id, raw);
}

export function evalRule({ field, op, value, userValue, caseSensitive = false }) {
  const handlers = HANDLERS[field.type];
  if (!handlers) return false;
  const fn = handlers[op];
  if (!fn) return false;
  const coercedRule = coerceRuleValue(field, op, value);
  return Boolean(fn(userValue, coercedRule, { caseSensitive }));
}

export function operatorLabel(op) {
  return OP_LABELS[op] ?? op;
}

const OP_LABELS = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  regex: 'matches regex',
  in: 'is one of',
  not_in: 'is not one of',
  is_empty: 'is empty',
  is_not_empty: 'is set',
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'between',
  before: 'before',
  after: 'after',
  within_last_days: 'in the last (days)',
  more_than_days_ago: 'more than (days) ago',
};
