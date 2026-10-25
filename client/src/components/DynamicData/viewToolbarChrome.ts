/** Shared toolbar banner padding/height — same on every Dynamic* view. */
export const VIEW_TOOLBAR_PAD_CLASS = 'print:hidden px-4 py-2.5 border-b flex-shrink-0';

/** Single-row toolbar (List / Card / Tree / Kanban / Calendar). flex-wrap lets mobile search expand onto the next row. */
export const VIEW_TOOLBAR_BANNER_CLASS = `${VIEW_TOOLBAR_PAD_CLASS} flex flex-wrap items-center gap-2`;

/** Multi-row toolbar shell (Table — top row + optional filter chrome). */
export const VIEW_TOOLBAR_STACK_CLASS = `${VIEW_TOOLBAR_PAD_CLASS} flex flex-col gap-2`;

export function viewToolbarBorderClass(isDarkMode: boolean): string {
  return isDarkMode ? 'border-gray-800' : 'border-gray-100';
}
