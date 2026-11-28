/** Shared React Query keys for portal list/config caches. */
export const queryKeys = {
  seqViews: {
    all: ['seq-views'],
    list: () => [...queryKeys.seqViews.all, 'list'],
    config: () => [...queryKeys.seqViews.all, 'config'],
  },
  devices: {
    all: ['devices'],
    list: (examId = '') => [...queryKeys.devices.all, 'list', String(examId || '')],
    config: () => [...queryKeys.devices.all, 'config'],
  },
  centerCsrMatching: {
    all: ['center-csr-matching'],
    list: (examId = '') => [...queryKeys.centerCsrMatching.all, 'list', String(examId || '')],
    config: () => [...queryKeys.centerCsrMatching.all, 'config'],
  },
  /** Device Master report tabs (Stats Center, Training, …) — rows in device_* collections. */
  deviceTabs: {
    all: ['device-tabs'],
    fields: (view = '') => [...queryKeys.deviceTabs.all, 'fields', String(view || '')],
    list: (view = '', examId = '') => [
      ...queryKeys.deviceTabs.all,
      'list',
      String(view || ''),
      String(examId || ''),
    ],
  },
  devicePresets: {
    all: ['device-presets'],
    list: () => [...queryKeys.devicePresets.all, 'list'],
  },


  vendors: {
    all: ['vendors'],
    list: () => [...queryKeys.vendors.all, 'list'],
    config: () => [...queryKeys.vendors.all, 'config'],
  },
  exams: {
    all: ['exams'],
    list: () => [...queryKeys.exams.all, 'list'],
    config: () => [...queryKeys.exams.all, 'config'],
    rows: (examId, page = 1, limit = 100, search = '', filtersSig = '', all = false, view = 'center-list') => [
      ...queryKeys.exams.all,
      'rows',
      String(examId || ''),
      String(view || 'center-list'),
      all ? 'all' : Number(page) || 1,
      all ? 'all' : Number(limit) || 100,
      String(search || '').trim(),
      String(filtersSig || ''),
    ],
    details: () => [...queryKeys.exams.all, 'detail'],
    detail: (examId) => [...queryKeys.exams.details(), String(examId || '')],
    table: (examId, view = 'center-list') => [
      ...queryKeys.exams.all,
      'table',
      String(examId || ''),
      String(view || 'center-list'),
    ],
    presets: () => [...queryKeys.exams.all, 'presets'],
    links: (examId) => [...queryKeys.exams.all, 'links', String(examId || '')],
  },
  configLists: ['config-lists'],
  platformSettings: ['platform-settings'],
  supportSettings: ['support-settings'],
  feedback: {
    all: ['feedback'],
    mine: () => [...queryKeys.feedback.all, 'mine'],
    list: () => [...queryKeys.feedback.all, 'list'],
  },
  /** Public portal name / logo / favicon (works on login). */
  platformBranding: ['platform-branding'],
  messageTemplates: ['message-templates'],
  integrations: {
    email: ['integrations', 'email'],
    storage: ['integrations', 'storage'],
    push: ['integrations', 'push'],
  },
  tableLayout: (tableId) => ['table-layout', String(tableId || '')],
  lookupResolve: (sig) => ['lookup-resolve', sig],
  users: {
    all: ['users'],
    list: () => [...queryKeys.users.all, 'list'],
    tags: () => [...queryKeys.users.all, 'tags'],
    groups: () => [...queryKeys.users.all, 'groups'],
  },
  /** Assignee picker people for a set of user-tag ids (sig = sorted join). */
  assignableUsers: (tagSig = '') => ['assignable-users', String(tagSig || '')],
  /** Paginated assignee pages — include search so each query stays distinct. */
  assignableUsersPage: (tagSig = '', search = '') => [
    'assignable-users-page',
    String(tagSig || ''),
    String(search || ''),
  ],
};
