// Each campaign points at a seed group by id. The free-text `audience`
// label stays as a display fallback — rendered only if the referenced
// group disappears.

export const campaigns = [
  { id: 'c_spring26', name: 'Spring Kickoff 2026',    status: 'active',   audienceGroupId: 'grp_company',          audience: 'All Employees', startsAt: '2026-03-01', endsAt: '2026-05-31', participation: 0.64 },
  { id: 'c_peer_eng', name: 'Peer Engineering Awards', status: 'active',   audienceGroupId: 'grp_engineering',      audience: 'Engineering',   startsAt: '2026-02-14', endsAt: '2026-06-14', participation: 0.48 },
  { id: 'c_onboard',  name: 'Onboarding Buddies',     status: 'draft',    audienceGroupId: 'grp_new_hires_365d',   audience: 'New Hires',     startsAt: '2026-05-01', endsAt: '2026-12-31', participation: 0 },
  { id: 'c_q1wins',   name: 'Q1 Wins',                status: 'archived', audienceGroupId: 'grp_company',          audience: 'All Employees', startsAt: '2026-01-01', endsAt: '2026-03-31', participation: 0.82 },
];
