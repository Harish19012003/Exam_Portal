import type { FeedbackComponentName } from './registry';
import type { NotificationEntry, NotificationShowOptions, ToastVariant } from './types';

interface NotificationPreset extends NotificationShowOptions {
  variant: ToastVariant;
}

const STACK_ITEMS: NotificationEntry[] = [
  {
    title: 'Export completed',
    message: 'Your CSV export is ready to download.',
    timestamp: '2m ago',
    unread: true,
  },
  {
    title: 'New comment',
    message: 'Alex replied on the Q4 budget row.',
    timestamp: '1h ago',
    unread: true,
  },
  {
    title: 'Sync successful',
    message: 'Table preferences were saved to the cloud.',
    timestamp: 'Yesterday',
    unread: false,
  },
];

export const NOTIFICATION_PRESETS: Partial<Record<FeedbackComponentName, NotificationPreset>> = {
  'notification.item': {
    variant: 'success',
    title: 'Export completed',
    message: 'Your CSV export is ready to download.',
    tertiary: 'Available for 7 days in your exports folder.',
    timestamp: 'Just now',
    unread: false,
    duration: 8000,
  },
  'notification.unread': {
    variant: 'info',
    title: 'New assignment',
    message: 'You were added to the Marketing table.',
    tertiary: 'Open the table to view your access level.',
    timestamp: '5m ago',
    unread: true,
    duration: null,
  },
  'notification.actions': {
    variant: 'warning',
    title: 'Review requested',
    message: 'Sam asked you to approve 12 pending rows.',
    timestamp: '12m ago',
    unread: true,
    duration: null,
    actions: [
      { label: 'Dismiss', variant: 'secondary' },
      { label: 'Open', variant: 'secondary' },
      { label: 'Mark read', variant: 'primary' },
    ],
  },
  'notification.stack': {
    variant: 'info',
    title: 'Notifications',
    items: STACK_ITEMS,
    duration: null,
  },
};

export function resolveNotificationShow(
  name: FeedbackComponentName,
  overrides?: NotificationShowOptions,
): NotificationPreset & NotificationShowOptions {
  const preset = NOTIFICATION_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      title: 'Preview',
      message: `${name} is not implemented yet.`,
      timestamp: 'Now',
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isNotificationName(name: FeedbackComponentName): boolean {
  return name.startsWith('notification.');
}

export function isNotificationStack(name: FeedbackComponentName): boolean {
  return name === 'notification.stack';
}
