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
    rows: (examId) => [...queryKeys.exams.all, 'rows', String(examId || '')],
  },
  users: {
    all: ['users'],
    list: () => [...queryKeys.users.all, 'list'],
    tags: () => [...queryKeys.users.all, 'tags'],
    groups: () => [...queryKeys.users.all, 'groups'],
  },
};
