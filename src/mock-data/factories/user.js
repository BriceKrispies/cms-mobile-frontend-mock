let counter = 1000;

const firstNames = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Avery', 'Rowan'];
const lastNames  = ['Ng', 'Patel', 'Kowalski', 'Johnson', 'Garcia', 'Silva', 'Park', 'Nguyen', 'Wright', 'Brooks'];
const teams      = ['Brand', 'Platform', 'Mobile', 'People Ops', 'Support', 'Growth', 'Insights'];
const roles      = ['Engineer', 'Designer', 'Analyst', 'Manager', 'Program Manager', 'Support Specialist'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function makeUser(overrides = {}) {
  const first = pick(firstNames);
  const last  = pick(lastNames);
  counter += 1;
  return {
    id: `u_g_${counter}`,
    name: `${first} ${last}`,
    email: `${first}.${last}`.toLowerCase() + '@acme.co',
    role: pick(roles),
    team: pick(teams),
    status: 'active',
    joined: new Date(Date.now() - Math.random() * 3e10).toISOString().slice(0, 10),
    ...overrides,
  };
}

export function makeUsers(count, overrides) {
  return Array.from({ length: count }, () => makeUser(overrides));
}
