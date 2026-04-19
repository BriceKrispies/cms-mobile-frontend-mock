// Group resolution. Pure logic — no DOM, no mock-data. Consumes the
// schema for field metadata and is given users + groups by the caller
// (mockApi). Cycle-safe: repeated visits to the same group while
// resolving short-circuit to the empty set with a recorded error.

import { getField } from '../schema/index.js';
import { evalRule } from './operators.js';

const MAX_DEPTH = 32;

export function resolveDefinition(definition, { users, groups }) {
  const errors = [];
  const memo = new Map();
  const visiting = new Set();
  const allIds = () => new Set(users.map((u) => u.id));

  function resolveGroupRef(id, depth) {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) {
      errors.push(`Cycle detected at group "${id}"`);
      return new Set();
    }
    const group = (groups || []).find((g) => g.id === id);
    if (!group) {
      errors.push(`Unknown group "${id}"`);
      return new Set();
    }
    visiting.add(id);
    const result = walk(group.definition, depth + 1);
    visiting.delete(id);
    memo.set(id, result);
    return result;
  }

  function walk(node, depth) {
    if (depth > MAX_DEPTH) {
      errors.push('Maximum nesting depth exceeded');
      return new Set();
    }
    if (!node || typeof node !== 'object' || typeof node.kind !== 'string') {
      return new Set();
    }
    switch (node.kind) {
      case 'all':  return allIds();
      case 'none': return new Set();
      case 'users': {
        const ids = Array.isArray(node.ids) ? node.ids : [];
        const valid = new Set(ids.filter((id) => users.some((u) => u.id === id)));
        return valid;
      }
      case 'group': return resolveGroupRef(node.id, depth);
      case 'rule': {
        const out = new Set();
        const field = getField(node.field);
        if (!field) {
          errors.push(`Unknown field "${node.field}"`);
          return out;
        }
        for (const u of users) {
          const ok = evalRule({
            field,
            op: node.op,
            value: node.value,
            userValue: u[node.field],
            caseSensitive: !!node.caseSensitive,
          });
          if (ok) out.add(u.id);
        }
        return out;
      }
      case 'and': {
        const children = Array.isArray(node.children) ? node.children : [];
        if (!children.length) return new Set();
        let result = walk(children[0], depth + 1);
        for (let i = 1; i < children.length && result.size; i++) {
          result = intersect(result, walk(children[i], depth + 1));
        }
        return result;
      }
      case 'or': {
        const children = Array.isArray(node.children) ? node.children : [];
        const result = new Set();
        for (const c of children) {
          for (const id of walk(c, depth + 1)) result.add(id);
        }
        return result;
      }
      case 'not': {
        const inner = walk(node.child, depth + 1);
        const result = allIds();
        for (const id of inner) result.delete(id);
        return result;
      }
      default:
        errors.push(`Unknown node kind "${node.kind}"`);
        return new Set();
    }
  }

  const ids = walk(definition, 0);
  return { ids, errors };
}

export function resolveGroupById(groupId, { users, groups }) {
  return resolveDefinition({ kind: 'group', id: groupId }, { users, groups });
}

function intersect(a, b) {
  const out = new Set();
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const id of small) if (large.has(id)) out.add(id);
  return out;
}
