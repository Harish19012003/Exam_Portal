/**
 * Feedback component registry — unique reference names for every variant.
 * Use these IDs in code, docs, and Feedback Lab.
 *
 * @example feedback.show('toast.success', { message: 'Saved!' })
 * @example FEEDBACK_COMPONENTS['confirm.delete']
 */

export const FEEDBACK_COMPONENTS = {
  // ── Toast ─────────────────────────────────────────────────────────────────
  'toast.success': {
    name: 'toast.success',
    label: 'Success toast',
    category: 'toast',
    description: 'Green check · auto-dismiss ~3s',
  },
  'toast.error': {
    name: 'toast.error',
    label: 'Error toast',
    category: 'toast',
    description: 'Red icon · sticky until dismissed',
  },
  'toast.warning': {
    name: 'toast.warning',
    label: 'Warning toast',
    category: 'toast',
    description: 'Amber icon · auto-dismiss or manual close',
  },
  'toast.info': {
    name: 'toast.info',
    label: 'Info toast',
    category: 'toast',
    description: 'Blue icon · short informational message',
  },
  'toast.action': {
    name: 'toast.action',
    label: 'Action toast',
    category: 'toast',
    description: 'Message + primary / secondary action buttons',
  },
  'toast.undo': {
    name: 'toast.undo',
    label: 'Undo toast',
    category: 'toast',
    description: 'Action with countdown progress bar (e.g. row deleted)',
  },
  'toast.undoEdit': {
    name: 'toast.undoEdit',
    label: 'Undo edit toast',
    category: 'toast',
    description: 'Undo bar after row edit or bulk update',
  },

  // ── Alert modal ───────────────────────────────────────────────────────────
  'alert.info': {
    name: 'alert.info',
    label: 'Info alert',
    category: 'alert',
    description: 'Single OK button · informational',
  },
  'alert.warning': {
    name: 'alert.warning',
    label: 'Warning alert',
    category: 'alert',
    description: 'Amber icon · optional detail body',
  },
  'alert.error': {
    name: 'alert.error',
    label: 'Error alert',
    category: 'alert',
    description: 'Red icon · error message body',
  },
  'alert.success': {
    name: 'alert.success',
    label: 'Success alert',
    category: 'alert',
    description: 'Green icon · operation completed',
  },

  // ── Confirm modal ─────────────────────────────────────────────────────────
  'confirm.default': {
    name: 'confirm.default',
    label: 'Default confirm',
    category: 'confirm',
    description: 'Cancel + confirm · neutral primary',
  },
  'confirm.delete': {
    name: 'confirm.delete',
    label: 'Delete confirm',
    category: 'confirm',
    description: 'Destructive red primary action',
  },
  'confirm.discard': {
    name: 'confirm.discard',
    label: 'Discard changes',
    category: 'confirm',
    description: 'Unsaved changes · keep editing vs discard',
  },
  'confirm.custom': {
    name: 'confirm.custom',
    label: 'Custom actions confirm',
    category: 'confirm',
    description: 'Any number of custom action buttons',
  },

  // ── Input modal ───────────────────────────────────────────────────────────
  'input.single': {
    name: 'input.single',
    label: 'Single field input',
    category: 'input',
    description: 'One text input · submit / cancel',
  },
  'input.multi': {
    name: 'input.multi',
    label: 'Multi field input',
    category: 'input',
    description: 'Dynamic field schema (text, select, checkbox, …)',
  },
  'input.validation': {
    name: 'input.validation',
    label: 'Validated input',
    category: 'input',
    description: 'Required fields + inline error messages',
  },
  'input.prompt': {
    name: 'input.prompt',
    label: 'Prompt dialog',
    category: 'input',
    description: 'Simple “Enter value” prompt with one field',
  },

  // ── Flash banner ──────────────────────────────────────────────────────────
  'flash.info': {
    name: 'flash.info',
    label: 'Info flash',
    category: 'flash',
    description: 'Dismissible top page banner',
  },
  'flash.warning': {
    name: 'flash.warning',
    label: 'Warning flash',
    category: 'flash',
    description: 'Amber banner · important notice',
  },
  'flash.update': {
    name: 'flash.update',
    label: 'Update notice flash',
    category: 'flash',
    description: 'New feature / release announcement',
  },
  'flash.sticky': {
    name: 'flash.sticky',
    label: 'Sticky flash',
    category: 'flash',
    description: 'Persists until user dismisses',
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  'notification.item': {
    name: 'notification.item',
    label: 'Notification item',
    category: 'notifications',
    description: 'Title, body, timestamp',
  },
  'notification.unread': {
    name: 'notification.unread',
    label: 'Unread notification',
    category: 'notifications',
    description: 'Dot indicator + bold title',
  },
  'notification.actions': {
    name: 'notification.actions',
    label: 'Action notification',
    category: 'notifications',
    description: 'Mark read · open · dismiss actions',
  },
  'notification.stack': {
    name: 'notification.stack',
    label: 'Notification stack',
    category: 'notifications',
    description: 'Grouped list of notification items',
  },

  // ── Popup (anchored) ──────────────────────────────────────────────────────
  'popup.menu': {
    name: 'popup.menu',
    label: 'Popup menu',
    category: 'popup',
    description: 'Anchored action menu near trigger',
  },
  'popup.panel': {
    name: 'popup.panel',
    label: 'Popup panel',
    category: 'popup',
    description: 'Anchored panel with custom content',
  },

  // ── Tooltip ───────────────────────────────────────────────────────────────
  'tooltip.default': {
    name: 'tooltip.default',
    label: 'Default tooltip',
    category: 'tooltip',
    description: 'Single-line hint · appears on hover or focus',
  },
  'tooltip.info': {
    name: 'tooltip.info',
    label: 'Info tooltip',
    category: 'tooltip',
    description: 'Primary message + muted secondary line',
  },
  'tooltip.shortcut': {
    name: 'tooltip.shortcut',
    label: 'Shortcut tooltip',
    category: 'tooltip',
    description: 'Label with keyboard shortcut badge',
  },
  'tooltip.rich': {
    name: 'tooltip.rich',
    label: 'Rich tooltip',
    category: 'tooltip',
    description: 'Bold title · body · optional footnote',
  },
  'tooltip.compact': {
    name: 'tooltip.compact',
    label: 'Compact pill',
    category: 'tooltip',
    description: 'Minimal dark pill · tight padding · single line',
  },
  'tooltip.dark': {
    name: 'tooltip.dark',
    label: 'Dark tooltip',
    category: 'tooltip',
    description: 'Solid dark surface · high contrast · always inverted',
  },
  'tooltip.brand': {
    name: 'tooltip.brand',
    label: 'Brand tooltip',
    category: 'tooltip',
    description: 'Accent border and tint using VisionHQ green',
  },
  'tooltip.icon': {
    name: 'tooltip.icon',
    label: 'Icon tooltip',
    category: 'tooltip',
    description: 'Info icon badge beside title and message',
  },
  'tooltip.warning': {
    name: 'tooltip.warning',
    label: 'Warning tooltip',
    category: 'tooltip',
    description: 'Amber status tint with warning icon',
  },
  'tooltip.success': {
    name: 'tooltip.success',
    label: 'Success tooltip',
    category: 'tooltip',
    description: 'Green status tint with check icon',
  },
  'tooltip.multiShortcut': {
    name: 'tooltip.multiShortcut',
    label: 'Multi-shortcut tooltip',
    category: 'tooltip',
    description: 'Label with a row of keyboard shortcut badges',
  },
  'tooltip.list': {
    name: 'tooltip.list',
    label: 'List tooltip',
    category: 'tooltip',
    description: 'Title with bulleted tips inside the tooltip',
  },
  'tooltip.caret': {
    name: 'tooltip.caret',
    label: 'Caret tooltip',
    category: 'tooltip',
    description: 'Standard card with arrow pointer toward the trigger',
  },

  // ── Loading ───────────────────────────────────────────────────────────────
  'loading.spinner': {
    name: 'loading.spinner',
    label: 'Spinner',
    category: 'loading',
    description: 'Inline spinning indicator + label',
  },
  'loading.loader': {
    name: 'loading.loader',
    label: 'Page loader',
    category: 'loading',
    description: 'Overlay · blocks interaction until done',
  },
  'loading.progressbar': {
    name: 'loading.progressbar',
    label: 'Progress bar',
    category: 'loading',
    description: 'Determinate horizontal bar with percentage',
  },
  'loading.indeterminate': {
    name: 'loading.indeterminate',
    label: 'Indeterminate bar',
    category: 'loading',
    description: 'Animated strip · unknown duration',
  },
  'loading.progresscircle': {
    name: 'loading.progresscircle',
    label: 'Progress circle',
    category: 'loading',
    description: 'Circular ring with percentage',
  },
  'loading.skeleton': {
    name: 'loading.skeleton',
    label: 'Skeleton',
    category: 'loading',
    description: 'Placeholder shimmer while content loads',
  },
  'loading.dots': {
    name: 'loading.dots',
    label: 'Loading dots',
    category: 'loading',
    description: 'Three-dot pulse · inline / compact',
  },

  // ── Table ─────────────────────────────────────────────────────────────────
  'table.dummy': {
    name: 'table.dummy',
    label: 'Dummy table',
    category: 'table',
    description: 'Sample data grid preview for Feedback Lab',
  },

  // ── Banner ────────────────────────────────────────────────────────────────
  'banner.info': {
    name: 'banner.info',
    label: 'Info banner',
    category: 'banner',
    description: 'Inline info strip · dismissible · content area',
  },
  'banner.promo': {
    name: 'banner.promo',
    label: 'Promo banner',
    category: 'banner',
    description: 'Promotional call-to-action · inline card',
  },
  'banner.warning': {
    name: 'banner.warning',
    label: 'Warning banner',
    category: 'banner',
    description: 'Inline warning · action button optional',
  },
  'banner.success': {
    name: 'banner.success',
    label: 'Success banner',
    category: 'banner',
    description: 'Inline success state · compact message',
  },

  // ── Field design ──────────────────────────────────────────────────────────
  'field.text': {
    name: 'field.text',
    label: 'Text input',
    category: 'field',
    description: 'Single-line text · default state',
  },
  'field.email': {
    name: 'field.email',
    label: 'Email input',
    category: 'field',
    description: 'Email type · validation-friendly',
  },
  'field.number': {
    name: 'field.number',
    label: 'Number input',
    category: 'field',
    description: 'Numeric entry · stepper native',
  },
  'field.select': {
    name: 'field.select',
    label: 'Select',
    category: 'field',
    description: 'Dropdown · single choice',
  },
  'field.textarea': {
    name: 'field.textarea',
    label: 'Textarea',
    category: 'field',
    description: 'Multi-line text · resizable off',
  },
  'field.checkbox': {
    name: 'field.checkbox',
    label: 'Checkbox',
    category: 'field',
    description: 'Boolean toggle · label inline',
  },
  'field.error': {
    name: 'field.error',
    label: 'Error state',
    category: 'field',
    description: 'Invalid input · red border + message',
  },
  'field.disabled': {
    name: 'field.disabled',
    label: 'Disabled state',
    category: 'field',
    description: 'Read-only · muted background',
  },
  'field.readonly': {
    name: 'field.readonly',
    label: 'Read only',
    category: 'field',
    description: 'Non-editable · copy-friendly',
  },
  'field.password': {
    name: 'field.password',
    label: 'Password',
    category: 'field',
    description: 'Masked text entry',
  },
  'field.tel': {
    name: 'field.tel',
    label: 'Phone',
    category: 'field',
    description: 'Tel input · formatted numbers',
  },
  'field.url': {
    name: 'field.url',
    label: 'URL',
    category: 'field',
    description: 'Web address · protocol hint',
  },
  'field.search': {
    name: 'field.search',
    label: 'Search',
    category: 'field',
    description: 'Search type · clear button native',
  },
  'field.date': {
    name: 'field.date',
    label: 'Date',
    category: 'field',
    description: 'Date picker · ISO format',
  },
  'field.time': {
    name: 'field.time',
    label: 'Time',
    category: 'field',
    description: 'Time picker · 24h or locale',
  },
  'field.datetime': {
    name: 'field.datetime',
    label: 'Date & time',
    category: 'field',
    description: 'Combined datetime-local',
  },
  'field.color': {
    name: 'field.color',
    label: 'Color',
    category: 'field',
    description: 'Color swatch picker',
  },
  'field.range': {
    name: 'field.range',
    label: 'Range slider',
    category: 'field',
    description: 'Numeric range · slider UI',
  },
  'field.radio': {
    name: 'field.radio',
    label: 'Radio group',
    category: 'field',
    description: 'Single choice · mutually exclusive',
  },
  'field.file': {
    name: 'field.file',
    label: 'File upload',
    category: 'field',
    description: 'File input · browse button',
  },
  'field.settings.toggle': {
    name: 'field.settings.toggle',
    label: 'Settings toggle',
    category: 'field',
    description: 'Switch row · no top label · inline title',
  },
  'field.table.search': {
    name: 'field.table.search',
    label: 'Table search',
    category: 'field',
    description: 'Compact toolbar search · no label',
  },
  'field.table.text': {
    name: 'field.table.text',
    label: 'Table text cell',
    category: 'field',
    description: 'Inline text editor · compact',
  },
  'field.table.number': {
    name: 'field.table.number',
    label: 'Table number cell',
    category: 'field',
    description: 'Inline numeric cell · compact',
  },
  'field.table.select': {
    name: 'field.table.select',
    label: 'Table select cell',
    category: 'field',
    description: 'Inline dropdown cell · compact',
  },
  'field.table.date': {
    name: 'field.table.date',
    label: 'Table date cell',
    category: 'field',
    description: 'Inline date cell · compact',
  },
  'field.table.checkbox': {
    name: 'field.table.checkbox',
    label: 'Table checkbox',
    category: 'field',
    description: 'Row selection · no label',
  },
  'field.table.bulk': {
    name: 'field.table.bulk',
    label: 'Table bulk edit',
    category: 'field',
    description: 'Labeled bulk panel field',
  },
} as const;

export type FeedbackComponentName = keyof typeof FEEDBACK_COMPONENTS;

export type FeedbackCategory =
  | 'toast'
  | 'alert'
  | 'confirm'
  | 'input'
  | 'flash'
  | 'notifications'
  | 'popup'
  | 'tooltip'
  | 'loading'
  | 'table'
  | 'banner'
  | 'field';

export function getComponentsByCategory(category: FeedbackCategory) {
  return Object.values(FEEDBACK_COMPONENTS).filter(c => c.category === category);
}

export function getAllComponentNames(): FeedbackComponentName[] {
  return Object.keys(FEEDBACK_COMPONENTS) as FeedbackComponentName[];
}

/** Total count for overview stats */
export const FEEDBACK_COMPONENT_COUNT = Object.keys(FEEDBACK_COMPONENTS).length;
