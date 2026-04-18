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
    { key: 'requestedBy', label: 'Requested by', render: (r) => r.requestedBy.name },
    { key: 'requestedFor', label: 'For', render: (r) => r.requestedFor.name },
    { key: 'points', label: 'Points' },
    { key: 'submittedAt', label: 'Submitted', render: (r) => new Date(r.submittedAt).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (r) => r.status },
  ];
  shell.rows = rows;
}

export const routes = [{ path: '/approvals', mount }];
