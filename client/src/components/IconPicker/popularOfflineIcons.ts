export interface OfflineIconItem {
  name: string;
  label: string;
  category: string;
}

export const POPULAR_OFFLINE_ICONS: OfflineIconItem[] = [
  { name: 'external-link', label: 'External Link', category: 'Links' },
  { name: 'chevron-right', label: 'Chevron Expand', category: 'Navigation' },
  { name: 'eye', label: 'Eye View', category: 'Actions' },
  { name: 'share', label: 'Share', category: 'Actions' },
  { name: 'star', label: 'Star Favorite', category: 'Status' },
  { name: 'download', label: 'Download', category: 'Actions' },
  { name: 'info', label: 'Info', category: 'Status' },
  { name: 'settings', label: 'Settings', category: 'System' },
  { name: 'plus', label: 'Plus Add', category: 'Actions' },
  { name: 'edit', label: 'Edit', category: 'Actions' },
  { name: 'trash', label: 'Trash Delete', category: 'Actions' },
  { name: 'copy', label: 'Copy', category: 'Actions' },
  { name: 'check', label: 'Checkmark', category: 'Status' },
  { name: 'file', label: 'File Document', category: 'Files' },
  { name: 'folder', label: 'Folder', category: 'Files' },
  { name: 'user', label: 'User Profile', category: 'Entities' },
  { name: 'heart', label: 'Heart', category: 'Status' },
  { name: 'mail', label: 'Mail Email', category: 'Entities' },
  { name: 'phone', label: 'Phone Call', category: 'Entities' },
  { name: 'calendar', label: 'Calendar', category: 'System' },
  { name: 'lock', label: 'Lock Security', category: 'System' },
  { name: 'globe', label: 'Globe World', category: 'Links' },
  { name: 'bell', label: 'Bell Notification', category: 'Status' },
  { name: 'search', label: 'Search Magnify', category: 'Actions' },
  { name: 'bookmark', label: 'Bookmark', category: 'Status' },
  { name: 'send', label: 'Send Direct', category: 'Actions' },
  { name: 'sliders', label: 'Filter Sliders', category: 'System' },
];

export const ICON_PICKER_CATEGORIES = ['All', 'Links', 'Actions', 'Status', 'Files', 'Entities', 'System'] as const;
