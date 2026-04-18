import { companyValues } from '../fixtures/values.js';

let counter = 9000;

const phrases = [
  'Stayed late to unblock the team on a tricky deploy.',
  'Led the customer workshop with clarity and kindness.',
  'Re-scoped the project to land the most important slice first.',
  'Jumped in on a domain they had no context in and made real progress.',
  'Left the codebase measurably better than they found it.',
  'Wrote the kind of RFC you want to read twice.',
  'Turned a painful process into something I actually look forward to.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sample(arr, n) {
  const copy = [...arr];
  const out = [];
  while (n-- > 0 && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

export function makeRecognition({ fromId, toId, status = 'approved' } = {}) {
  counter += 1;
  const valueLabels = sample(companyValues, 1 + Math.floor(Math.random() * 2)).map((v) => v.label);
  return {
    id: `r_g_${counter}`,
    fromId: fromId ?? 'u_001',
    toId:   toId   ?? 'u_002',
    message: pick(phrases),
    values: valueLabels,
    points: [15, 25, 40, 50, 75][Math.floor(Math.random() * 5)],
    likes: Math.floor(Math.random() * 30),
    status,
    createdAt: new Date(Date.now() - Math.random() * 1e10).toISOString(),
  };
}

export function makeRecognitions(count, opts) {
  return Array.from({ length: count }, () => makeRecognition(opts));
}
