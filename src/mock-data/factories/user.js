let counter = 1000;

const firstNames = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Avery', 'Rowan'];
const lastNames  = ['Ng', 'Patel', 'Kowalski', 'Johnson', 'Garcia', 'Silva', 'Park', 'Nguyen', 'Wright', 'Brooks'];
const teams      = ['Brand', 'Platform', 'Mobile', 'People Ops', 'Support', 'Growth', 'Insights'];
const roles      = ['Engineer', 'Designer', 'Analyst', 'Manager', 'Program Manager', 'Support Specialist'];
const titles     = ['Engineer II', 'Senior Engineer', 'Staff Engineer', 'Senior Designer', 'Data Analyst', 'Program Manager', 'Support Specialist', 'Senior Product Manager'];
const levels     = ['L2', 'L3', 'L4', 'L5', 'L6', 'Staff'];
const departments = ['Engineering', 'Design', 'Operations', 'Go-to-market', 'Support'];
const locations  = ['San Francisco', 'New York', 'London', 'Berlin', 'Toronto', 'Sydney', 'Tokyo', 'Mexico City', 'Dublin', 'Bangalore'];
const countries  = ['US', 'GB', 'DE', 'CA', 'AU', 'JP', 'MX', 'IE', 'IN'];
const employmentTypes = ['full_time', 'full_time', 'full_time', 'contractor']; // weighted toward full_time
const timezones  = ['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Australia/Sydney', 'Asia/Tokyo', 'Europe/Dublin', 'Asia/Kolkata'];

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
    title: pick(titles),
    level: pick(levels),
    department: pick(departments),
    location: pick(locations),
    country: pick(countries),
    employmentType: pick(employmentTypes),
    timezone: pick(timezones),
    hiredAt: new Date(Date.now() - Math.random() * 3e10).toISOString().slice(0, 10),
    ...overrides,
  };
}

export function makeUsers(count, overrides) {
  return Array.from({ length: count }, () => makeUser(overrides));
}
