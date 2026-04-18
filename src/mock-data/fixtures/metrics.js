export const dashboardMetrics = [
  { id: 'm_recognitions', label: 'Recognitions this month', value: '1,284', delta: '+12% vs. last month', tone: 'up' },
  { id: 'm_participation', label: 'Active participation',    value: '72%',    delta: '+4 pts vs. last month', tone: 'up' },
  { id: 'm_pending',       label: 'Pending approvals',       value: '8',      delta: '-3 vs. last week',     tone: 'down',
    footnote: 'Down means fewer in queue — good.' },
  { id: 'm_points',        label: 'Points redeemed (mo)',    value: '$4,120', delta: 'Flat',                 tone: 'flat' },
];

export const participationTrend = [
  { week: 'W1', value: 58 },
  { week: 'W2', value: 63 },
  { week: 'W3', value: 66 },
  { week: 'W4', value: 72 },
];
