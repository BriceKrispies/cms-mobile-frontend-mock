// Seed fields shipped with the app. These mirror what the user fixture
// has always populated, plus the richer attributes needed by the group
// system. Seed fields can have their label/description/enumValues
// edited via the /schema feature, but not their id or type, and cannot
// be deleted.

export const SEED_FIELDS = [
  { id: 'name',           label: 'Name',            type: 'string', description: 'Full display name.' },
  { id: 'email',          label: 'Email',           type: 'string', description: 'Work email address.' },
  { id: 'role',           label: 'Role',            type: 'string', description: 'Functional role (e.g. Engineer, Designer).' },
  {
    id: 'team',
    label: 'Team',
    type: 'string',
    description: 'Immediate team the person belongs to.',
    enumValues: ['Brand', 'Platform', 'Mobile', 'People Ops', 'Support', 'Growth', 'Insights'],
  },
  {
    id: 'status',
    label: 'Status',
    type: 'string',
    description: 'Employment lifecycle state.',
    enumValues: ['active', 'invited', 'offboarding'],
  },
  { id: 'title',          label: 'Job Title',       type: 'string', description: 'Title shown on the directory card.' },
  {
    id: 'level',
    label: 'Level',
    type: 'string',
    description: 'Career level or band.',
    enumValues: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'Staff', 'Principal'],
  },
  {
    id: 'department',
    label: 'Department',
    type: 'string',
    description: 'Higher-level org grouping above team.',
    enumValues: ['Engineering', 'Design', 'Operations', 'Go-to-market', 'Support'],
  },
  { id: 'location',       label: 'Location',        type: 'string', description: 'Primary office or city.' },
  { id: 'country',        label: 'Country',         type: 'string', description: 'ISO country code.' },
  { id: 'managerId',      label: 'Manager',         type: 'string', description: 'User id of the person they report to.' },
  {
    id: 'employmentType',
    label: 'Employment Type',
    type: 'string',
    description: 'Contractual arrangement.',
    enumValues: ['full_time', 'contractor', 'intern'],
  },
  { id: 'timezone',       label: 'Timezone',        type: 'string', description: 'IANA timezone identifier.' },
  { id: 'hiredAt',        label: 'Hired At',        type: 'date',   description: 'Date the person joined.' },
];
