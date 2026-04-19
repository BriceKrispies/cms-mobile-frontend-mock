// Structural + semantic validation of a group definition. Runs before
// save (blocks persistence on errors) and continuously in the builder
// (so the user sees inline errors). Cycles are caught by the resolver
// at runtime — this module only catches the trivial self-reference.

import { getField, operatorsForField } from '../schema/index.js';

const MAX_DEPTH = 32;

export function validateDefinition(definition, { ownerId } = {}) {
  const errors = [];

  function walk(node, path, depth) {
    if (depth > MAX_DEPTH) {
      errors.push({ path, message: 'Group nesting too deep' });
      return;
    }
    if (!node || typeof node !== 'object' || typeof node.kind !== 'string') {
      errors.push({ path, message: 'Missing node kind' });
      return;
    }
    switch (node.kind) {
      case 'all':
      case 'none':
        return;
      case 'users':
        if (!Array.isArray(node.ids)) {
          errors.push({ path, message: 'users.ids must be an array' });
        }
        return;
      case 'group':
        if (typeof node.id !== 'string' || !node.id) {
          errors.push({ path, message: 'group.id is required' });
        } else if (ownerId && node.id === ownerId) {
          errors.push({ path, message: 'A group cannot reference itself' });
        }
        return;
      case 'rule': {
        if (typeof node.field !== 'string' || !node.field) {
          errors.push({ path, message: 'rule.field is required' });
          return;
        }
        const field = getField(node.field);
        if (!field) {
          errors.push({ path, message: `Unknown field "${node.field}"` });
          return;
        }
        const ops = operatorsForField(node.field);
        if (!ops.includes(node.op)) {
          errors.push({ path, message: `Operator "${node.op}" doesn't apply to ${field.type}` });
          return;
        }
        if (node.op === 'regex') {
          try { new RegExp(node.value); }
          catch { errors.push({ path, message: 'Invalid regex pattern' }); }
        }
        if (node.op === 'between') {
          if (!Array.isArray(node.value) || node.value.length !== 2) {
            errors.push({ path, message: 'between needs two values' });
          }
        }
        if ((node.op === 'in' || node.op === 'not_in') && !Array.isArray(node.value)) {
          errors.push({ path, message: `${node.op} needs a list of values` });
        }
        if ((node.op === 'within_last_days' || node.op === 'more_than_days_ago') && !Number.isFinite(Number(node.value))) {
          errors.push({ path, message: 'Number of days is required' });
        }
        return;
      }
      case 'and':
      case 'or':
        if (!Array.isArray(node.children) || node.children.length === 0) {
          errors.push({ path, message: `${node.kind.toUpperCase()} needs at least one child` });
          return;
        }
        node.children.forEach((c, i) => walk(c, `${path}.${node.kind}[${i}]`, depth + 1));
        return;
      case 'not':
        if (!node.child) {
          errors.push({ path, message: 'not.child is required' });
        } else {
          walk(node.child, `${path}.not`, depth + 1);
        }
        return;
      default:
        errors.push({ path, message: `Unknown node kind "${node.kind}"` });
    }
  }

  walk(definition, '$', 0);
  return errors;
}
