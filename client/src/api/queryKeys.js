/** Shared React Query keys for portal list/config caches. */
export const queryKeys = {
  seqViews: {
    all: ['seq-views'],
    list: () => [...queryKeys.seqViews.all, 'list'],
    config: () => [...queryKeys.seqViews.all, 'config'],
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
    rows: (examId, page = 1, limit = 100) => [
      ...queryKeys.exams.all,
      'rows',
      String(examId || ''),
      Number(page) || 1,
      Number(limit) || 100,
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
};
