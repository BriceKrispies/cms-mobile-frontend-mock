import { mockApi } from '../../mock-data/api/mockApi.js';
import { escapeHtml } from '../../utils/dom.js';

async function mount({ outlet }) {
  const rows = await mockApi.listApprovals({ status: 'pending' });

  const wrap = document.createElement('section');
  wrap.className = 'u-container';
  wrap.innerHTML = `
    <page-header
      eyebrow="Queue"
      title="Approvals"
      description="Review recognitions awaiting manager approval."></page-header>

    <data-table-shell title="Pending approvals" count="${rows.length}"></data-table-shell>
  `;
  outlet.appendChild(wrap);

  const shell = wrap.querySelector('data-table-shell');
  shell.columns = [
    { key: 'requestedFor', label: 'For', priority: 'title',
      sortable: true, filter: 'text',
      sortValue: (r) => r.requestedFor.name,
      filterValue: (r) => r.requestedFor.name,
      render: (r) => r.requestedFor.name },
    { key: 'requestedBy', label: 'Requested by', priority: 'subtitle',
      sortable: true, filter: 'text',
      sortValue: (r) => r.requestedBy.name,
      filterValue: (r) => r.requestedBy.name,
      render: (r) => `from ${r.requestedBy.name}` },
    { key: 'points', label: 'Points',
      sortable: true, type: 'number' },
    { key: 'submittedAt', label: 'Submitted',
      sortable: true, type: 'date',
      render: (r) => new Date(r.submittedAt).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (r) => r.status },
  ];
  shell.rows = rows;
}

export const routes = [{ path: '/approvals', mount }];
