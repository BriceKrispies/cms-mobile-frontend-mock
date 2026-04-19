// Seed messages for the Message Board. Each message targets either an
// existing group (audienceGroupId) or carries an ad-hoc definition
// (audienceDefinition). Reactions and replies are nested so the whole
// board can be persisted with a single localStorage key.

export const messages = [
  {
    id: 'msg_company_kickoff',
    authorId: 'u_006',
    body: 'Welcome to the Spring Kickoff! Over the next quarter we will be sharing weekly wins, highlighting teams, and rolling out a new recognition program. Stay tuned, and keep the kudos flowing.',
    audienceGroupId: 'grp_company',
    audienceDefinition: null,
    createdAt: '2026-04-12T14:30:00.000Z',
    reactions: [
      { userId: 'u_001', emoji: '🎉' },
      { userId: 'u_002', emoji: '🎉' },
      { userId: 'u_003', emoji: '❤️' },
      { userId: 'u_004', emoji: '👍' },
      { userId: 'u_005', emoji: '👍' },
    ],
    replies: [
      {
        id: 'rep_kickoff_01',
        authorId: 'u_003',
        body: 'So excited to see the team highlights return this year!',
        createdAt: '2026-04-12T15:02:00.000Z',
      },
      {
        id: 'rep_kickoff_02',
        authorId: 'u_007',
        body: 'Mobile is ready 💪',
        createdAt: '2026-04-12T15:48:00.000Z',
      },
    ],
  },
  {
    id: 'msg_eng_release',
    authorId: 'u_002',
    body: 'Platform release 2026.4 is live in canary. If you see anything odd with auth or the dashboard, drop a note in #platform-oncall.',
    audienceGroupId: 'grp_engineering',
    audienceDefinition: null,
    createdAt: '2026-04-15T09:15:00.000Z',
    reactions: [
      { userId: 'u_004', emoji: '👀' },
      { userId: 'u_005', emoji: '👍' },
      { userId: 'u_007', emoji: '👍' },
    ],
    replies: [
      {
        id: 'rep_release_01',
        authorId: 'u_004',
        body: 'Seeing a slow login on first hit — I will grab a HAR.',
        createdAt: '2026-04-15T09:42:00.000Z',
      },
    ],
  },
  {
    id: 'msg_new_hires',
    authorId: 'u_006',
    body: 'Welcome to everyone who joined in the past year! We are running a buddy-match session next Thursday. Reply here if you would like to be paired with a mentor.',
    audienceGroupId: 'grp_new_hires_365d',
    audienceDefinition: null,
    createdAt: '2026-04-17T11:00:00.000Z',
    reactions: [
      { userId: 'u_008', emoji: '❤️' },
      { userId: 'u_009', emoji: '🎉' },
    ],
    replies: [
      {
        id: 'rep_hires_01',
        authorId: 'u_008',
        body: 'Count me in!',
        createdAt: '2026-04-17T11:22:00.000Z',
      },
    ],
  },
  {
    id: 'msg_emea_lunch',
    authorId: 'u_003',
    body: 'EMEA crew — doing a virtual coffee Friday 15:00 London time. Drop a 👀 if you can make it.',
    audienceGroupId: null,
    audienceDefinition: {
      kind: 'rule',
      field: 'country',
      op: 'in',
      value: ['GB', 'DE', 'FR', 'IE', 'ES', 'IT', 'NL', 'PL', 'GH', 'NG', 'ZA'],
    },
    createdAt: '2026-04-18T08:00:00.000Z',
    reactions: [
      { userId: 'u_001', emoji: '👀' },
      { userId: 'u_008', emoji: '👀' },
      { userId: 'u_010', emoji: '❤️' },
    ],
    replies: [],
  },
];
