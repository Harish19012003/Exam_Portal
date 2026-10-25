import type { ComponentType } from 'react';
import { Icon } from '@iconify/react';
import {
  ExternalLink,
  ChevronRight,
  Eye,
  Share2,
  Star,
  Download,
  Info,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Pencil,
  Maximize2,
  PanelRightOpen,
  Copy,
  Check,
  FileText,
  User,
  Heart,
  Mail,
  Phone,
  Calendar,
  Lock,
  Globe,
  Bell,
  Search,
  Bookmark,
  Folder,
  Link,
  Send,
  Sliders,
  Sparkles,
} from 'lucide-react';

const LUCIDE_MAP: Record<string, ComponentType<{ className?: string }>> = {
  'external-link': ExternalLink,
  redirect: ExternalLink,
  link: Link,
  'chevron-right': ChevronRight,
  chevron: ChevronRight,
  expand: ChevronRight,
  eye: Eye,
  view: Eye,
  share: Share2,
  'share-2': Share2,
  star: Star,
  download: Download,
  info: Info,
  settings: Settings,
  plus: Plus,
  edit: Edit2,
  pencil: Pencil,
  trash: Trash2,
  'trash-2': Trash2,
  delete: Trash2,
  'maximize-2': Maximize2,
  modal: Maximize2,
  'panel-right-open': PanelRightOpen,
  drawer: PanelRightOpen,
  copy: Copy,
  check: Check,
  file: FileText,
  user: User,
  heart: Heart,
  mail: Mail,
  phone: Phone,
  calendar: Calendar,
  lock: Lock,
  globe: Globe,
  bell: Bell,
  search: Search,
  bookmark: Bookmark,
  folder: Folder,
  send: Send,
  sliders: Sliders,
  sparkles: Sparkles,
};

export interface DynamicIconProps {
  iconName?: string;
  className?: string;
  fallbackIcon?: ComponentType<{ className?: string }>;
}

export function DynamicIcon({
  iconName,
  className = 'w-4 h-4',
  fallbackIcon: FallbackComponent = ExternalLink,
}: DynamicIconProps) {
  if (!iconName) {
    return <FallbackComponent className={className} />;
  }

  const normalized = iconName.toLowerCase().trim();
  const cleanName = normalized.replace(/^lucide:/, '');

  const LucideComp = LUCIDE_MAP[normalized] || LUCIDE_MAP[cleanName];
  if (LucideComp) {
    return <LucideComp className={className} />;
  }

  try {
    return (
      <Icon
        icon={iconName.includes(':') ? iconName : `lucide:${cleanName}`}
        className={className}
        onError={() => null}
      />
    );
  } catch {
    return <FallbackComponent className={className} />;
  }
}
