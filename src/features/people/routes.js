import { mockApi } from '../../mock-data/api/mockApi.js';

// Columns are opted into by id; label and value formatting come from
// the schema registry. Adding a field in /schema and appending its id
// here is the only way to surface a new column. Zero hardcoded labels
// or formatters.
const COLUMN_IDS = ['name', 'title', 'team', 'department', 'level', 'location', 'hiredAt'];
const PRIORITY = {
  name: 'title',
  title: 'subtitle',
  team: 'subtitle',
};

function buildColumns() {
  return COLUMN_IDS
    .map((id) => {
      const field = mockApi.getField(id);
      if (!field) return null;
      return {
        key: id,
        label: field.label,
        priority: PRIORITY[id],
        render: (user) => mockApi.formatValue(id, user[id]),
      };
    })
    .filter(Boolean);
}

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

  shell.columns = buildColumns();

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
