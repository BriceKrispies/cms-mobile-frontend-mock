// Seed groups shipped with the app. These exercise every mechanic
// (rule on enum, rule on freeform string with regex, rule on date,
// group reference for rollup, AND / NOT for exclusion). Seed groups
// can have their name/description edited but their definition is
// immutable, mirroring how seed schema fields work.

export const SEED_GROUPS = [
  {
    id: 'grp_company',
    name: 'Everyone',
    description: 'All active people in the directory.',
    definition: { kind: 'all' },
  },
  {
    id: 'grp_engineering',
    name: 'Engineering',
    description: 'Anyone in the Engineering department.',
    definition: {
      kind: 'rule',
      field: 'department',
      op: 'equals',
      value: 'Engineering',
    },
  },
  {
    id: 'grp_engineering_managers',
    name: 'Engineering managers',
    description: 'Engineers with "manager" or "lead" in their job title.',
    definition: {
      kind: 'and',
      children: [
        { kind: 'group', id: 'grp_engineering' },
        { kind: 'rule', field: 'title', op: 'regex', value: '(manager|lead|head|vp|director)' },
      ],
    },
  },
  {
    id: 'grp_engineering_ics',
    name: 'Engineering ICs',
    description: 'Individual contributors in Engineering — engineering minus the management group.',
    definition: {
      kind: 'and',
      children: [
        { kind: 'group', id: 'grp_engineering' },
        { kind: 'not', child: { kind: 'group', id: 'grp_engineering_managers' } },
      ],
    },
  },
  {
    id: 'grp_new_hires_365d',
    name: 'New hires (last year)',
    description: 'Anyone whose hire date is within the last 365 days.',
    definition: {
      kind: 'rule',
      field: 'hiredAt',
      op: 'within_last_days',
      value: 365,
    },
  },
  {
    id: 'grp_emea',
    name: 'EMEA',
    description: 'People based in Europe, Middle East, or Africa.',
    definition: {
      kind: 'rule',
      field: 'country',
      op: 'in',
      value: ['GB', 'DE', 'FR', 'IE', 'ES', 'IT', 'NL', 'PL', 'GH', 'NG', 'ZA'],
    },
  },
];
