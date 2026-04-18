import { mockApi } from '../../mock-data/api/mockApi.js';

async function mount({ outlet }) {
  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Directory"
      title="People"
      description="Everyone who can give and receive recognition."></page-header>

    <filter-bar placeholder="Search by name, team, or role…" id="people-filter"></filter-bar>
    <div style="margin-top: var(--space-4)">
      <data-table-shell title="All people" id="people-shell"></data-table-shell>
    </div>
  `;
  outlet.appendChild(wrap);

  const shell = wrap.querySelector('#people-shell');
  const filter = wrap.querySelector('#people-filter');

  shell.columns = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'team', label: 'Team' },
    { key: 'status', label: 'Status' },
    { key: 'joined', label: 'Joined' },
  ];

  const teams = await mockApi.listTeams();
  filter.chips = [{ id: 'all', label: 'All teams' }, ...teams.map((t) => ({ id: t, label: t }))];
  filter.active = 'all';

  let state = { search: '', active: 'all' };
  const load = async () => {
    const rows = await mockApi.listPeople({
      search: state.search,
      team: state.active === 'all' ? undefined : state.active,
    });
    shell.setAttribute('count', String(rows.length));
    shell.rows = rows;
  };
  filter.addEventListener('filter-change', (e) => { state = e.detail; load(); });

  await load();
}

export const routes = [{ path: '/people', mount }];
