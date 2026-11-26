import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  CloudDownload,
  FileBarChart2,
  GraduationCap,
  Link2,
  PieChart,
  RefreshCw,
  Smartphone,
  UserPlus,
  UserRoundCheck,
  Users,
} from 'lucide-react';

/** Device Master sidebar pages (same idea as exam Center list / Exam Day). */
export const DEVICE_MASTER_VIEWS = [
  {
    tab: 'devices',
    label: 'Param',
    icon: Smartphone,
    title: 'Param',
    subtitle: 'Param (shift) rows for the selected bio exam.',
  },
  {
    tab: 'stats-center',
    label: 'Stats Center',
    icon: BarChart3,
    title: 'Stats Center',
    subtitle: 'Stats center data for the selected bio exam.',
  },
  {
    tab: 'oprsummary',
    label: 'Oprsummary',
    icon: ClipboardList,
    title: 'Oprsummary',
    subtitle: 'Operator summary data for the selected bio exam.',
  },
  {
    tab: 'sync-pending',
    label: 'Sync Pending',
    icon: RefreshCw,
    title: 'Sync Pending',
    subtitle: 'Pending sync rows for the selected bio exam.',
  },
  {
    tab: 'data-download',
    label: 'Data Download',
    icon: CloudDownload,
    title: 'Data Download',
    subtitle: 'Data download rows for the selected bio exam.',
  },
  {
    tab: 'training',
    label: 'Training',
    icon: GraduationCap,
    title: 'Training',
    subtitle: 'Training rows for the selected bio exam.',
  },
  {
    tab: 'non-aadhaar-enrollments',
    label: 'Non Aadhaar Enrollments',
    icon: UserPlus,
    title: 'Non Aadhaar Enrollments',
    subtitle: 'Non-Aadhaar enrollment rows for the selected bio exam.',
  },
  {
    tab: 'aadhaar-enrollments',
    label: 'Aadhaar Enrollments',
    icon: UserRoundCheck,
    title: 'Aadhaar Enrollments',
    subtitle: 'Aadhaar enrollment rows for the selected bio exam.',
  },
  {
    tab: 'csr',
    label: 'CSR',
    icon: Users,
    title: 'CSR',
    subtitle: 'CSR rows for the selected bio exam.',
  },
  {
    tab: 'center-csr-matching',
    label: 'Center-CSR-Matching',
    icon: Link2,
    title: 'Center-CSR-Matching',
    subtitle: 'Center and CSR matching rows for the selected bio exam.',
  },
  {
    tab: 'modality-report',
    label: 'Modality Report',
    icon: FileBarChart2,
    title: 'Modality Report',
    subtitle: 'Modality report data for Device Master.',
  },
  {
    tab: 'modality-summary',
    label: 'Modality Summary',
    icon: PieChart,
    title: 'Modality Summary',
    subtitle: 'Modality summary for Device Master.',
  },
  {
    tab: 'aadhaar-failed-reason',
    label: 'Aadhaar Failed Reason',
    icon: AlertTriangle,
    title: 'Aadhaar Failed Reason',
    subtitle: 'Failed Aadhaar reason rows for Device Master.',
  },
];

export const DEFAULT_DEVICE_MASTER_VIEW = 'devices';

export const isDeviceMasterViewKey = (tab) =>
  DEVICE_MASTER_VIEWS.some((v) => v.tab === String(tab || '').trim());

export const deviceMasterViewMeta = (tab) =>
  DEVICE_MASTER_VIEWS.find((v) => v.tab === String(tab || '').trim()) || DEVICE_MASTER_VIEWS[0];

export const deviceMasterPath = (tab = DEFAULT_DEVICE_MASTER_VIEW) => {
  const key = isDeviceMasterViewKey(tab) ? tab : DEFAULT_DEVICE_MASTER_VIEW;
  return `/device-master/${key}`;
};
