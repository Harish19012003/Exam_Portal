import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { UserGroupTabs, UserGroupModal } from './users/UserGroupTabs';
import { UserAccessModal } from './users/UserAccessModal';
import { AssignTagsDialog, ManageTagsDialog } from './users/UserTagDialogs';
import { PageHeading } from '../components/PageHeading';
import { apiClient } from '../api/client';
import { useConfirm, useFeedback } from '../feedback';
import { useToast } from '../components/ui/Toast';
import { DynamicTable, TableSkeleton } from '../components/DynamicTable';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { useInvalidateUsers, useUsersList, useUserTags, useUserGroups } from '../hooks/useUsersQuery';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import { usePortalTableFeatures, withPortalFeatureLocks } from '../hooks/usePortalTableFeatures';
import { TABLE_IDS } from '../constants/tableIds';
import { ROLES, AVAILABLE_RIGHTS, DEFAULT_ROLE_PERMISSIONS } from '@exam-view/shared';
import {
  Users,
  Crown,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Globe,
  User,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  AlertTriangle,
  Mail,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  FileText,
  Upload,
  Eye,
  EyeOff,
  Zap,
  ShieldOff,
  Tag,
} from 'lucide-react';
import { SearchableSelect } from './exams/SearchableSelect';
import './ExamsPage.css';
import './UsersPage.css';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, +05:30)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT, -05:00)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT, -08:00)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT, -06:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST, +00:00)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST, +01:00)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST, +01:00)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, +04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, +08:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, +09:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT, +10:00)' },
];

const ROLE_SELECT_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'global_admin', label: 'Global Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Standard User' },
];

const STATUS_SELECT_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const ROLE_LABELS = { super_admin: 'Super Admin', global_admin: 'Global Admin', admin: 'Admin', user: 'User' };
const STATUS_LABELS = { active: 'Active', inactive: 'Inactive', suspended: 'Suspended' };

/** Dynamic Table columns. The composite "User" column shows avatar, name, email, phone and the Primary tag; its source fields stay hidden. */
const USER_COLUMNS = [
  { key: 'user', label: 'User', dataType: 'composite', order: 1, visible: true, width: 300, filterable: true,
    composedOf: [
      { field: 'avatar', role: 'avatar' },
      { field: 'full_name', role: 'primary' },
      { field: 'email', role: 'secondary' },
      { field: 'primary_tag', role: 'badge' },
      { field: 'phone_number', role: 'tertiary' },
    ] },
  { key: 'role', label: 'Role', dataType: 'dropdown', options: Object.values(ROLE_LABELS), order: 2, visible: true, width: 150, editable: false, filterable: true, sortable: true },
  { key: 'status', label: 'Status', dataType: 'status', options: Object.values(STATUS_LABELS), order: 4, visible: true, width: 130, editable: false, filterable: true, sortable: true },
  { key: 'two_fa', label: '2FA Security', dataType: 'status', options: ['2FA ON', '2FA OFF'], order: 5, visible: true, width: 140, editable: false, filterable: true, sortable: true },
  { key: 'timezone', label: 'Timezone', dataType: 'text', order: 6, visible: true, width: 170, editable: false, filterable: true, sortable: true },
  { key: 'last_active_at', label: 'Last Activity', dataType: 'datetime', order: 7, visible: true, width: 200, editable: false, filterable: true, sortable: true },
  { key: 'avatar', label: 'Avatar', dataType: 'image', order: 8, visible: false, width: 60, editable: false },
  { key: 'full_name', label: 'Name', dataType: 'text', order: 9, visible: false, width: 180, editable: false, filterable: true, sortable: true },
  { key: 'email', label: 'Email', dataType: 'email', order: 10, visible: false, width: 220, editable: false, filterable: true, sortable: true },
  { key: 'phone_number', label: 'Phone', dataType: 'text', order: 11, visible: false, width: 150, editable: false, filterable: true, sortable: true },
  { key: 'primary_tag', label: 'Primary Tag', dataType: 'text', order: 12, visible: false, width: 110, editable: false },
];

/** The Tags column is built from the current tag list, so its filter options and chip colours stay in step. */
const buildUserColumns = (tags) => [
  ...USER_COLUMNS,
  {
    key: 'tags',
    label: 'Tags',
    dataType: 'tags',
    options: tags.map((t) => t.name),
    optionColors: Object.fromEntries(tags.map((t) => [t.name, t.color])),
    order: 3,
    visible: true,
    width: 240,
    editable: false,
    filterable: true,
    sortable: false,
  },
];

/** `actionsSlot`: when embedded in Settings, the header element the action buttons are shown in (left of the section dropdown). */
/** What the table shows until an admin changes it in the Feature Builder (saved for everyone). */
const USER_TABLE_DEFAULTS = {
  enableSearch: true,
  enableRefresh: true,
  enableExport: true,
  enableImport: true,
  enableFullScreen: true,
  enableDensity: true,
  enableSettings: true,
  enableQuickFilters: false,
  enableSummaryChips: false,
  enableSavedViews: false,
  enableFooter: false,
  enableOpenDetail: false,
  enableRowSelection: false,
  enableBulkActions: false,
  enableCellEditing: false,
  enableActionsColumn: true,
};

export const UsersPage = ({ embedded = false, actionsSlot = null }) => {
  const confirm = useConfirm();
  const { show: showFeedback } = useFeedback();
  const usersQuery = useUsersList();
  const tagsQuery = useUserTags();
  const groupsQuery = useUserGroups();
  const queryClient = useQueryClient();
  const { invalidateList: invalidateUsersList, refetchList: refetchUsersList } = useInvalidateUsers();
  const users = usersQuery.data || [];
  const loading = usersQuery.isPending && !usersQuery.data;
  const [groups, setGroups] = useState([]);
  const [groupModal, setGroupModal] = useState(null); // null | { group: object | null }
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');
  // Confirmations and errors show as toasts (top right), like the other portal pages, instead of a banner that shifts the page down.
  const { addToast } = useToast();
  const setSuccessMsg = useCallback((message) => { if (message) addToast(message, 'success'); }, [addToast]);
  const setError = useCallback((message) => { if (message) addToast(message, 'error'); }, [addToast]);

  // Search & Filter & Sort
  // 'all' | 'role:<role>' | 'group:<id>'
  const [activeTab, setActiveTab] = useState('all');

  // Toggle summary stats cards visibility (default: false / off)
  const [showStats, setShowStats] = useState(() => {
    try {
      const saved = localStorage.getItem('users_show_stats_v2');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleStats = () => {
    setShowStats((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('users_show_stats_v2', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };


  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bulk upload state
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Active user for Edit
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states for Create User
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    role: 'user',
    status: 'active',
    timezone: 'UTC',
    two_factor_enabled: false,
    permissions: DEFAULT_ROLE_PERMISSIONS.user || [],
  });

  // Form states for Edit User
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'user',
    status: 'active',
    timezone: 'UTC',
    two_factor_enabled: false,
    permissions: [],
  });

  // Current logged in user
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isPrimaryAdmin = Boolean(currentUser?.is_primary);
  const canDisable2FA = ['super_admin', 'global_admin', 'admin'].includes(currentUser?.role);

  // Transfer Primary state
  const [transferTargetUser, setTransferTargetUser] = useState(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferConfirmText, setTransferConfirmText] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Sync currentUser with localStorage on external or tab updates
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}'));
      } catch {
        setCurrentUser({});
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleOpenTransferModal = (user) => {
    setTransferTargetUser(user);
    setTransferConfirmText('');
    setIsTransferModalOpen(true);
  };

  const handleTransferPrimarySubmit = async (e) => {
    e.preventDefault();
    if (!transferTargetUser || transferConfirmText.trim().toUpperCase() !== 'TRANSFER') {
      return;
    }
    try {
      setTransferSubmitting(true);
      setError('');
      const response = await apiClient.post(`/users/${transferTargetUser.id}/transfer-primary`);
      setSuccessMsg(
        response.data?.data?.message ||
        `Primary Super Admin status successfully transferred to ${transferTargetUser.first_name || ''} ${transferTargetUser.last_name || ''} (${transferTargetUser.email}).`
      );

      // Update localStorage & state for current user
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...stored, is_primary: false };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      window.dispatchEvent(new Event('storage'));

      setIsTransferModalOpen(false);
      setTransferTargetUser(null);
      setTransferConfirmText('');

      // Close edit drawer if open
      setIsEditModalOpen(false);
      setSelectedUser(null);

      // Refresh users list
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to transfer Primary Super Admin status.');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      setError('');
      await refetchUsersList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    }
  }, [refetchUsersList, setError]);

  useEffect(() => {
    if (usersQuery.isError) {
      setError(usersQuery.error?.response?.data?.message || 'Failed to load users');
    }
  }, [usersQuery.isError, usersQuery.error, setError]);

  // ── User groups (custom tabs) ──────────────────────────────────────────────
  // ── Tags (central list; users hold tag ids) ─────────────────────────────────
  const tags = tagsQuery.data || [];
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [assignTagsUser, setAssignTagsUser] = useState(null);

  const fetchTags = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.users.tags() });
  }, [queryClient]);

  // Reload users without the full-page loading state, so the table does not blink after a tag change.
  const refreshUsers = useCallback(async () => {
    try {
      await invalidateUsersList();
    } catch {
      /* the next full load will report it */
    }
  }, [invalidateUsersList]);

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const userColumns = useMemo(() => buildUserColumns(tags), [tags]);
  const tagsKey = useMemo(() => tags.map((t) => `${t.id}:${t.name}:${t.color}`).join('|'), [tags]);

  const fetchGroups = useCallback(async () => {
    try {
      const result = await groupsQuery.refetch();
      setGroups(result.data || []);
    } catch {
      setGroups([]);
    }
  }, [groupsQuery]);

  useEffect(() => {
    if (Array.isArray(groupsQuery.data)) setGroups(groupsQuery.data);
  }, [groupsQuery.data]);

  const closeGroupModal = () => {
    setGroupModal(null);
    setGroupError('');
  };

  const handleSaveGroup = async (payload) => {
    setGroupSaving(true);
    setGroupError('');
    try {
      const existing = groupModal?.group;
      const response = existing
        ? await apiClient.put(`/users/groups/${existing.id}`, payload)
        : await apiClient.post('/users/groups', payload);
      await fetchGroups();
      const saved = response.data.data;
      if (saved?.id) setActiveTab(`group:${saved.id}`);
      closeGroupModal();
    } catch (err) {
      setGroupError(err.response?.data?.message || 'Could not save the group.');
    } finally {
      setGroupSaving(false);
    }
  };

  // ── Personal access overrides (Super Admin only) ───────────────────────────
  const [accessModalUser, setAccessModalUser] = useState(null);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState('');

  const handleSaveAccess = async (overrides) => {
    if (!accessModalUser) return;
    setAccessSaving(true);
    setAccessError('');
    try {
      await apiClient.put(`/users/${accessModalUser.id}`, { access_overrides: overrides });
      setSuccessMsg(`Access for ${accessModalUser.email} saved.`);
      setAccessModalUser(null);
      await fetchUsers();
    } catch (err) {
      setAccessError(err.response?.data?.message || 'Could not save access.');
    } finally {
      setAccessSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    const existing = groupModal?.group;
    if (!existing) return;
    const ok = await confirm({
      title: 'Delete group?',
      message: `Delete the group "${existing.name}"?`,
      tertiary: 'The users stay; only the group is removed.',
      confirmLabel: 'Delete group',
      destructive: true,
    });
    if (!ok) return;
    setGroupSaving(true);
    try {
      await apiClient.delete(`/users/groups/${existing.id}`);
      await fetchGroups();
      if (activeTab === `group:${existing.id}`) setActiveTab('all');
      closeGroupModal();
    } catch (err) {
      setGroupError(err.response?.data?.message || 'Could not delete the group.');
    } finally {
      setGroupSaving(false);
    }
  };

  // Lock body scroll and listen for ESC key when any modal is open
  useEffect(() => {
    const isAnyOpen = isEditModalOpen || isCreateModalOpen || isBulkUploadModalOpen || isTransferModalOpen;
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !transferSubmitting) {
          setIsEditModalOpen(false);
          setIsCreateModalOpen(false);
          setIsBulkUploadModalOpen(false);
          setIsTransferModalOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isEditModalOpen, isCreateModalOpen, isBulkUploadModalOpen, isTransferModalOpen, transferSubmitting]);

  // Stats calculation
  const totalUsers = users.length;
  const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
  const adminCount = users.filter((u) => u.role === 'admin' || u.role === 'global_admin').length;
  const twoFaEnabledCount = users.filter((u) => Boolean(u.two_factor_enabled)).length;

  // Users in the selected tab. Search, filters and sorting are handled by the table itself.
  const processedUsers = useMemo(() => {
    let result = [...users];

    // Filter by tab: a role, or a custom group's members
    if (activeTab.startsWith('role:')) {
      const role = activeTab.slice(5);
      result = result.filter((u) => u.role === role);
    } else if (activeTab.startsWith('group:')) {
      const group = groups.find((g) => g.id === activeTab.slice(6));
      const memberIds = new Set((group?.userIds || []).map(String));
      result = result.filter((u) => memberIds.has(String(u.id)));
    }

    // Primary admin first, then most recent activity
    result.sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      const timeA = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
      const timeB = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [users, groups, activeTab]);

  // ── Dynamic Table wiring ───────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const {
    layoutReady,
    layoutPrefs,
    hasUserLayoutOverride,
    layoutEpoch,
    canSaveLayoutAsDefault,
    onLayoutPrefsChange,
    onSaveLayoutAsDefault,
    onResetLayoutToDefault,
  } = useTableLayoutPrefs(TABLE_IDS.USERS);

  const tableRows = useMemo(
    () =>
      processedUsers.map((u) => ({
        rowId: String(u.id),
        version: 1,
        values: {
          avatar: '',
          full_name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'User',
          email: u.email || '',
          phone_number: u.phone_number || '',
          primary_tag: u.is_primary ? 'Primary' : '',
          tags: (u.tag_ids || []).map((id) => tagById.get(String(id))?.name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
          role: ROLE_LABELS[u.role] || 'User',
          status: STATUS_LABELS[u.status || 'active'] || 'Active',
          two_fa: u.two_factor_enabled ? '2FA ON' : '2FA OFF',
          timezone: u.timezone || 'UTC',
          last_active_at: u.last_active_at || '',
        },
      })),
    [processedUsers, tagById],
  );

  // The row actions call the latest handlers without rebuilding the table's feature config on every render.
  const userActionsRef = useRef(() => null);
  // Edit and Delete are the table's own standard buttons (wired below). Transfer and Disable 2FA are extra icon buttons in the same style.
  userActionsRef.current = (row) => {
    const u = users.find((x) => String(x.id) === row.rowId);
    if (!u) return null;
    const showTransfer = isPrimaryAdmin && !u.is_primary && u.role === 'super_admin' && u.status === 'active';
    const showDisable2FA = Boolean(u.two_factor_enabled) && canDisable2FA;
    const showTags = isSuperAdmin;
    if (!showTransfer && !showDisable2FA && !showTags) return null;
    return (
      <>
        {showTags && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAssignTagsUser(u);
            }}
            className="p-1 rounded-lg transition-colors text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"
            aria-label="Assign tags"
            title="Assign tags"
          >
            <Tag className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        {showDisable2FA && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDisable2FA(u.id, u.email);
            }}
            className="p-1 rounded-lg transition-colors text-gray-400 hover:text-rose-500 hover:bg-rose-50"
            aria-label="Disable 2FA"
            title="Disable 2FA for this user"
          >
            <ShieldOff className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        {showTransfer && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenTransferModal(u);
            }}
            className="p-1 rounded-lg transition-colors text-gray-400 hover:text-amber-500 hover:bg-amber-50"
            aria-label="Transfer Primary Tag"
            title={`Transfer Primary Super Admin authority to ${u.first_name || u.email}`}
          >
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </>
    );
  };

  const findUser = (row) => users.find((x) => String(x.id) === row.rowId);
  const handleTableEdit = (row) => {
    const u = findUser(row);
    if (!u) return;
    if (!isSuperAdmin) {
      showFeedback('alert.warning', { title: 'Not allowed', message: 'Only super admins can edit users.' });
      return;
    }
    handleOpenEdit(u);
  };
  // Delete keeps its protections (primary admin, own account) and the confirm dialog, then reloads the list.
  const handleTableDelete = (row) => {
    const u = findUser(row);
    if (!u) return;
    if (!isSuperAdmin) {
      showFeedback('alert.warning', { title: 'Not allowed', message: 'Only super admins can delete users.' });
      return;
    }
    handleDeleteUser(u);
  };

  // Feature Builder: admins change what the table offers, and Save publishes it for every user.
  const canConfigure = isSuperAdmin;
  const portalFeatures = usePortalTableFeatures({
    canConfigure,
    persist: async (features) => {
      const res = await apiClient.put('/users/table-config', { features });
      setSuccessMsg('Feature Builder settings saved for everyone');
      return res;
    },
  });
  const hydrateFeatures = portalFeatures.hydrate;
  useEffect(() => {
    let live = true;
    apiClient
      .get('/users/table-config')
      .then((res) => {
        const data = res.data?.data || res.data || {};
        if (live) hydrateFeatures({ ...USER_TABLE_DEFAULTS, ...(data.features || {}) });
      })
      .catch(() => live && hydrateFeatures({ ...USER_TABLE_DEFAULTS }));
    return () => {
      live = false;
    };
  }, [hydrateFeatures]);

  const tableFeatures = useMemo(
    () =>
      withPortalFeatureLocks({
        ...portalFeatures.features,
        rowActions: {
          ...portalFeatures.features.rowActions,
          // Standard Edit / Delete buttons, but only for super admins. The table's panel icon and Explore/Duplicate don't apply here.
          showEdit: isSuperAdmin && portalFeatures.features.rowActions?.showEdit !== false,
          showDelete: isSuperAdmin && portalFeatures.features.rowActions?.showDelete !== false,
          showExplore: false,
          showDuplicate: false,
          showRecordSidebar: false,
          renderCustomActions: (row) => userActionsRef.current(row),
        },
      }),
    // userActionsRef always holds the latest handlers; the button set is rebuilt when who is signed in changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portalFeatures.features, isSuperAdmin, isPrimaryAdmin, canDisable2FA, currentUser?.id],
  );

  // Open Edit Modal
  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    let parsedPerms = [];
    if (Array.isArray(user.permissions)) {
      parsedPerms = user.permissions;
    } else if (typeof user.permissions === 'string') {
      try {
        parsedPerms = JSON.parse(user.permissions);
      } catch {
        parsedPerms = [];
      }
    } else {
      parsedPerms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    }

    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || '',
      role: user.role || 'user',
      status: user.status || 'active',
      timezone: user.timezone || 'UTC',
      two_factor_enabled: Boolean(user.two_factor_enabled),
      permissions: parsedPerms,
    });
    setIsEditModalOpen(true);
  };

  // Handle Toggle Permission in Create Form
  const handleToggleCreatePermission = (permId) => {
    setCreateForm((prev) => {
      const exists = prev.permissions.includes(permId);
      const nextPerms = exists
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: nextPerms };
    });
  };

  // Handle Toggle Permission in Edit Form
  const handleToggleEditPermission = (permId) => {
    setEditForm((prev) => {
      const exists = prev.permissions.includes(permId);
      const nextPerms = exists
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: nextPerms };
    });
  };

  // Handle Create User Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      const payload = {
        ...createForm,
        phone_number: createForm.phone_number.trim() || null,
      };
      await apiClient.post('/users', payload);
      setSuccessMsg(`User ${createForm.email} created successfully.`);
      setIsCreateModalOpen(false);
      setCreateForm({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        password: '',
        role: 'user',
        status: 'active',
        timezone: 'UTC',
        two_factor_enabled: false,
        permissions: DEFAULT_ROLE_PERMISSIONS.user || [],
      });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit User Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      setError('');
      const payload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone_number: editForm.phone_number.trim() || null,
        role: editForm.role,
        status: editForm.status,
        timezone: editForm.timezone,
        permissions: editForm.permissions,
      };

      await apiClient.put(`/users/${selectedUser.id}`, payload);
      setSuccessMsg(`User ${selectedUser.email} updated successfully.`);
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  // Download Sample CSV Template
  const downloadSampleCSV = () => {
    const csvContent =
      'first_name,last_name,email,phone_number,role,status,timezone,password\n' +
      'John,Doe,john.doe@example.com,+1 555-0199,user,active,UTC,Password@123\n' +
      'Jane,Smith,jane.smith@example.com,+91 9876543210,admin,active,Asia/Kolkata,Password@123\n' +
      'Rahul,Sharma,rahul.sharma@example.com,+91 9811223344,user,active,Asia/Kolkata,Password@123\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'users_bulk_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV text and validate required headers
  const handleCSVFileChange = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setCsvError('Please upload a valid CSV (.csv) file.');
      return;
    }

    setCsvFile(file);
    setCsvError('');
    setBulkResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('CSV file must contain a header row and at least 1 user data row.');
        }

        const parseLine = (line) => {
          const values = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(cur.trim().replace(/^"|"$/g, ''));
              cur = '';
            } else {
              cur += char;
            }
          }
          values.push(cur.trim().replace(/^"|"$/g, ''));
          return values;
        };

        const rawHeaders = parseLine(lines[0]);
        const headers = rawHeaders.map((h) =>
          h.trim().toLowerCase().replace(/[\s_-]+/g, '_')
        );

        // Required headers validation: first_name and email
        const requiredHeaders = ['first_name', 'email'];
        const missing = requiredHeaders.filter((req) => !headers.includes(req));
        if (missing.length > 0) {
          throw new Error(
            `Missing required CSV header(s): "${missing.join('", "')}". The CSV header row MUST include "first_name" and "email".`
          );
        }

        setCsvHeaders(headers);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const parsedRows = [];
        const seenEmails = new Set();

        for (let i = 1; i < lines.length; i++) {
          const values = parseLine(lines[i]);
          if (values.every((v) => v === '')) continue; // Skip completely blank row

          const rowData = {};
          headers.forEach((h, idx) => {
            rowData[h] = values[idx] || '';
          });

          const firstName = rowData.first_name || rowData.firstname || '';
          const email = (rowData.email || '').trim().toLowerCase();
          const phone = rowData.phone_number || rowData.phone || '';

          let errorMsg = '';
          if (!firstName) {
            errorMsg = 'Missing first_name';
          } else if (!email) {
            errorMsg = 'Missing email';
          } else if (!emailRegex.test(email)) {
            errorMsg = 'Invalid email format';
          } else if (seenEmails.has(email)) {
            errorMsg = 'Duplicate email in this file';
          }

          if (email) seenEmails.add(email);

          parsedRows.push({
            rowNum: i,
            first_name: firstName,
            last_name: rowData.last_name || rowData.lastname || '',
            email,
            phone_number: phone,
            role: rowData.role || 'user',
            status: rowData.status || 'active',
            timezone: rowData.timezone || 'UTC',
            password: rowData.password || 'Password@123',
            isValid: !errorMsg,
            errorMsg,
          });
        }

        if (parsedRows.length === 0) {
          throw new Error('No user data rows found in the CSV file.');
        }

        setCsvData(parsedRows);
      } catch (err) {
        setCsvError(err.message || 'Failed to parse CSV file.');
        setCsvData([]);
      }
    };
    reader.readAsText(file);
  };

  // Submit Bulk Upload to Backend
  const handleBulkUploadSubmit = async () => {
    const validRows = csvData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setCsvError('No valid user records to upload. Please correct rows or upload a revised CSV.');
      return;
    }

    try {
      setBulkUploading(true);
      setCsvError('');
      const response = await apiClient.post('/users/bulk', { users: validRows });
      const result = response.data?.data || {};
      setBulkResult(result);
      setSuccessMsg(`Bulk upload finished! Successfully created ${result.successCount || validRows.length} users.`);
      fetchUsers();
    } catch (err) {
      setCsvError(err.response?.data?.message || 'Bulk upload request failed.');
    } finally {
      setBulkUploading(false);
    }
  };

  // Reset and close bulk upload modal
  const handleCloseBulkUpload = () => {
    setIsBulkUploadModalOpen(false);
    setCsvFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setCsvError('');
    setBulkResult(null);
  };

  // Handle Disable 2FA
  const handleDisable2FA = async (userId, userEmail) => {
    const ok = await confirm({
      title: 'Disable 2FA?',
      message: `Disable two-factor authentication for ${userEmail}?`,
      tertiary: 'They can sign in with just their password until they set 2FA up again.',
      confirmLabel: 'Disable 2FA',
      destructive: true,
    });
    if (!ok) return;
    try {
      setError('');
      await apiClient.post(`/users/${userId}/disable-2fa`);
      setSuccessMsg(`2FA has been disabled for ${userEmail}.`);
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, two_factor_enabled: false });
        setEditForm((prev) => ({ ...prev, two_factor_enabled: false }));
      }
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (user) => {
    if (user.is_primary) {
      showFeedback('alert.warning', { title: 'Account protected', message: 'The Primary Super Admin account is protected and cannot be deleted.' });
      return;
    }
    if (user.id === currentUser.id) {
      showFeedback('alert.warning', { title: 'Not allowed', message: 'You cannot delete your own account.' });
      return;
    }
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    const ok = await confirm({
      title: 'Delete user?',
      message: `Permanently delete ${fullName ? `${fullName} (${user.email})` : user.email}?`,
      confirmLabel: 'Delete user',
      destructive: true,
    });
    if (!ok) return;

    try {
      setError('');
      await apiClient.delete(`/users/${user.id}`);
      setSuccessMsg(`User ${user.email} removed.`);
      if (isEditModalOpen) setIsEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  // Helper component to render Lucide role badge
  const renderRoleBadge = (role) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="role-badge-pill super_admin">
            <Crown size={12} />
            <span>Super Admin</span>
          </span>
        );
      case 'global_admin':
        return (
          <span className="role-badge-pill global_admin">
            <Globe size={12} />
            <span>Global Admin</span>
          </span>
        );
      case 'admin':
        return (
          <span className="role-badge-pill admin">
            <Shield size={12} />
            <span>Admin</span>
          </span>
        );
      default:
        return (
          <span className="role-badge-pill user">
            <User size={12} />
            <span>User</span>
          </span>
        );
    }
  };

  const userActions = (
    <div className="users-header-actions">
      {isSuperAdmin && (
        <>
          <button
            type="button"
            className="bulk-upload-trigger-btn"
            onClick={() => setTagsDialogOpen(true)}
            title="Manage tags"
            aria-label="Manage tags"
          >
            <Tag size={18} />
          </button>
          <button
            type="button"
            className="bulk-upload-trigger-btn"
            onClick={() => setIsBulkUploadModalOpen(true)}
            title="Bulk Upload (CSV)"
            aria-label="Bulk Upload (CSV)"
          >
            <UploadCloud size={18} />
          </button>
          <button
            type="button"
            className="add-user-btn"
            onClick={() => setIsCreateModalOpen(true)}
            title="Add New User"
            aria-label="Add New User"
          >
            <Plus size={18} />
          </button>
        </>
      )}
      <button
        type="button"
        className={`toggle-stats-btn ${!showStats ? 'hidden-stats' : ''}`}
        onClick={toggleStats}
        title={showStats ? "Hide summary labels" : "Show summary labels"}
        aria-label={showStats ? "Hide summary labels" : "Show summary labels"}
        aria-pressed={showStats}
      >
        {showStats ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
    </div>
  );

  return (
    <div className={`users-page ${embedded ? 'embedded' : ''}`}>
      {/* Top Header (Non-embedded only) */}
      {!embedded && (
        <PageHeading
          title="User & Role Governance"
          info="Manage portal accounts, assign role-based access control, configure granular permissions, and audit last activity."
        />
      )}

      <UserGroupTabs
        users={users}
        groups={groups}
        value={activeTab}
        onChange={setActiveTab}
        onCreate={isSuperAdmin ? () => setGroupModal({ group: null }) : undefined}
        onEdit={isSuperAdmin ? (group) => setGroupModal({ group }) : undefined}
      />
      {groupModal && (
        <UserGroupModal
          group={groupModal.group}
          users={users}
          saving={groupSaving}
          error={groupError}
          onSave={handleSaveGroup}
          onDelete={handleDeleteGroup}
          onClose={closeGroupModal}
        />
      )}
      {tagsDialogOpen && (
        <ManageTagsDialog
          tags={tags}
          onClose={() => setTagsDialogOpen(false)}
          onChanged={async () => {
            await fetchTags();
            await refreshUsers();
          }}
        />
      )}
      {assignTagsUser && (
        <AssignTagsDialog
          user={assignTagsUser}
          tags={tags}
          onClose={() => setAssignTagsUser(null)}
          onSaved={refreshUsers}
          onTagsChanged={fetchTags}
        />
      )}
      {accessModalUser && (
        <UserAccessModal
          user={accessModalUser}
          groups={groups}
          saving={accessSaving}
          error={accessError}
          onSave={handleSaveAccess}
          onClose={() => {
            setAccessModalUser(null);
            setAccessError('');
          }}
        />
      )}

      {/* Actions: bulk upload, add user and the summary toggle. In Settings they sit beside the section dropdown;
          search, filters and sorting live in the table toolbar. */}
      {embedded && actionsSlot ? (
        createPortal(userActions, actionsSlot)
      ) : (
        <div className="users-controls" style={{ justifyContent: 'flex-end' }}>
          {userActions}
        </div>
      )}

      {/* Stats Row (Below Filters & Actions, toggleable via Eye icon) */}
      {showStats && (
        <div className="users-stats-grid">
          <div className="stat-card">
            <div className="stat-icon total">
              <Users size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Accounts</span>
              <span className="stat-value">{totalUsers}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon super">
              <Crown size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Super Admins</span>
              <span className="stat-value">{superAdminCount}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon admin">
              <Shield size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Admins</span>
              <span className="stat-value">{adminCount}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon twofa">
              <ShieldCheck size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">2FA Protected</span>
              <span className="stat-value">{twoFaEnabledCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Users Table (Dynamic Table) */}
      <div
        style={
          embedded
            ? { flex: '1 1 0', minHeight: 420, display: 'flex', flexDirection: 'column', minWidth: 0 }
            : { height: 'min(760px, calc(100vh - 340px))', minHeight: 420, display: 'flex', flexDirection: 'column', minWidth: 0 }
        }
      >
        {loading || !layoutReady || !portalFeatures.ready ? (
          <TableSkeleton isDarkMode={isDarkMode} columns={6} />
        ) : (
          <DynamicTable
            key={`users_layout_${layoutEpoch}_${tagsKey}`}
            tableId={TABLE_IDS.USERS}
            shareState={false}
            initialColumns={userColumns}
            initialRows={tableRows}
            layoutPrefs={layoutPrefs}
            onLayoutPrefsChange={onLayoutPrefsChange}
            canSaveLayoutAsDefault={canSaveLayoutAsDefault}
            hasUserLayoutOverride={hasUserLayoutOverride}
            onSaveLayoutAsDefault={
              canSaveLayoutAsDefault
                ? async (prefs) => {
                    const result = await onSaveLayoutAsDefault?.(prefs);
                    if (result?.message) (result.ok ? setSuccessMsg : setError)(result.message);
                  }
                : undefined
            }
            onResetLayoutToDefault={
              hasUserLayoutOverride
                ? async () => {
                    const result = await onResetLayoutToDefault?.();
                    if (result?.message) (result.ok ? setSuccessMsg : setError)(result.message);
                  }
                : undefined
            }
            onRefresh={fetchUsers}
            showAddRow={false}
            isDarkMode={isDarkMode}
            usePortalFeatures
            onEditRow={handleTableEdit}
            onDeleteRowRequest={handleTableDelete}
            enableFeatureBuilder={canConfigure}
            onFeaturesChange={canConfigure ? portalFeatures.onChange : undefined}
            onSaveFeatures={canConfigure ? portalFeatures.save : undefined}
            isSavingFeatures={portalFeatures.saving}
            featuresDirty={portalFeatures.dirty}
            features={tableFeatures}
          />
        )}
      </div>

      {/* 1. CREATE NEW USER MODAL */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="modal-content modal-form-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create New Portal Account"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 className="modal-title">
                  <Plus size={18} className="modal-title-icon" />
                  <span>Create New Portal Account</span>
                </h2>
                <p className="modal-subtitle">
                  Provision a new administrative or standard user account
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form-container">
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Alex"
                      value={createForm.first_name}
                      onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Morgan"
                      value={createForm.last_name}
                      onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="user@examview.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number (Optional)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +1 555-0199 or +91 9876543210"
                    value={createForm.phone_number}
                    onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Assign Role</label>
                    <SearchableSelect
                      portal
                      className="users-form-select"
                      ariaLabel="Role"
                      value={createForm.role}
                      options={ROLE_SELECT_OPTIONS}
                      onChange={(newRole) =>
                        setCreateForm({
                          ...createForm,
                          role: newRole,
                          permissions: DEFAULT_ROLE_PERMISSIONS[newRole] || [],
                        })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <SearchableSelect
                      portal
                      className="users-form-select"
                      ariaLabel="Status"
                      value={createForm.status}
                      options={STATUS_SELECT_OPTIONS}
                      onChange={(value) => setCreateForm({ ...createForm, status: value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>User Timezone</label>
                  <SearchableSelect
                    portal
                    className="users-form-select"
                    ariaLabel="Timezone"
                    value={createForm.timezone}
                    options={TIMEZONES}
                    onChange={(value) => setCreateForm({ ...createForm, timezone: value })}
                  />
                </div>

                {/* 2FA Informational Notice */}
                <div className="toggle-field twofa-info-field">
                  <div className="toggle-field-label">
                    <span className="toggle-title">Two-Factor Authentication (2FA)</span>
                    <span className="toggle-sub">
                      Disabled by default. For security reasons, 2FA must be configured and verified by the user themselves from their profile settings after login.
                    </span>
                  </div>
                  <div className="twofa-action-controls">
                    <span className="badge-2fa-status disabled">
                      <ShieldAlert size={13} />
                      <span>User Setup Only</span>
                    </span>
                  </div>
                </div>

                {/* Granular Rights Checklist */}
                <div className="rights-section-header">
                  <span>Granular Security Rights</span>
                  <button
                    type="button"
                    className="quick-rights-toggle"
                    onClick={() => {
                      const allIds = AVAILABLE_RIGHTS.map((r) => r.id);
                      const hasAll = allIds.every((id) => createForm.permissions.includes(id));
                      setCreateForm({
                        ...createForm,
                        permissions: hasAll ? [] : allIds,
                      });
                    }}
                  >
                    Toggle All
                  </button>
                </div>

                <div className="rights-checklist-grid">
                  {AVAILABLE_RIGHTS.map((r) => {
                    const isChecked = createForm.permissions.includes(r.id);
                    return (
                      <label key={r.id} className="right-checkbox-item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCreatePermission(r.id)}
                        />
                        <span>{r.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating User...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. UPDATE / EDIT USER MODAL */}
      {isEditModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div
            className="modal-content modal-edit-user"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Edit User & Permissions"
          >
            <div className="modal-header">
              <div className="modal-user-identity-header">
                <div className={`modal-user-avatar ${selectedUser.is_primary ? 'is-primary' : ''}`}>
                  {(selectedUser.first_name?.[0] || selectedUser.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="modal-user-identity-text">
                  <div className="modal-user-title-row">
                    <h2 className="modal-title">
                      {[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ') || 'User'}
                    </h2>
                    {selectedUser.is_primary && (
                      <span className="profile-primary-badge" title="Primary Super Admin with supreme authority">
                        <Zap size={11} strokeWidth={2.4} fill="currentColor" />
                        <span>Primary Admin</span>
                      </span>
                    )}
                  </div>
                  <div className="modal-user-sub-row">
                    <span className="modal-user-email">{selectedUser.email}</span>
                    <span className="modal-sub-sep">&bull;</span>
                    {renderRoleBadge(editForm.role || selectedUser.role)}
                    <span className={`profile-status-badge ${editForm.status || selectedUser.status || 'active'}`}>
                      <span className="status-dot"></span>
                      <span>{(editForm.status || selectedUser.status || 'active').toUpperCase()}</span>
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsEditModalOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="modal-form-container">
              <div className="modal-body">
                {selectedUser.is_primary && (
                  <div className="primary-admin-warning">
                    <AlertTriangle size={16} />
                    <span><strong>Primary Super Admin:</strong> This account holds supreme system authority. The primary admin role cannot be demoted.</span>
                  </div>
                )}

                {isSuperAdmin && selectedUser.role !== 'super_admin' && (
                  <div className="perm-open-row">
                    <span>Pages, tables, columns and rows this user can reach come from their groups.</span>
                    <button
                      type="button"
                      className="perm-open-btn"
                      onClick={() => {
                        setIsEditModalOpen(false);
                        setAccessModalUser(selectedUser);
                      }}
                    >
                      Personal access…
                    </button>
                  </div>
                )}

                {/* Transfer Primary Banner - Available when Primary Super Admin edits another active Super Admin */}
                {isPrimaryAdmin && !selectedUser.is_primary && selectedUser.role === 'super_admin' && selectedUser.status === 'active' && (
                  <div className="transfer-primary-banner">
                    <div className="transfer-primary-icon-wrap">
                      <Zap size={18} fill="currentColor" />
                    </div>
                    <div className="transfer-primary-details">
                      <span className="transfer-primary-title">Transfer Primary Ownership</span>
                      <span className="transfer-primary-sub">
                        Assign supreme Primary Super Admin authority to this account. Your account will automatically step down to standard Super Admin.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-transfer-primary-trigger"
                      onClick={() => handleOpenTransferModal(selectedUser)}
                      title="Transfer Primary Super Admin authority to this user"
                    >
                      <Zap size={13} fill="currentColor" />
                      <span>Transfer Primary Tag</span>
                    </button>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="form-input form-input-disabled"
                    value={selectedUser.email}
                    disabled
                    readOnly
                    title="Email address cannot be changed"
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +1 555-0199 or +91 9876543210"
                    value={editForm.phone_number}
                    onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Account Role</label>
                    <SearchableSelect
                      portal
                      className="users-form-select"
                      ariaLabel="Role"
                      value={editForm.role}
                      options={ROLE_SELECT_OPTIONS}
                      disabled={selectedUser.is_primary}
                      onChange={(newRole) =>
                        setEditForm({
                          ...editForm,
                          role: newRole,
                          permissions: DEFAULT_ROLE_PERMISSIONS[newRole] || [],
                        })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <SearchableSelect
                      portal
                      className="users-form-select"
                      ariaLabel="Status"
                      value={editForm.status}
                      options={STATUS_SELECT_OPTIONS}
                      disabled={selectedUser.is_primary}
                      onChange={(value) => setEditForm({ ...editForm, status: value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>User Timezone</label>
                  <SearchableSelect
                    portal
                    className="users-form-select"
                    ariaLabel="Timezone"
                    value={editForm.timezone}
                    options={TIMEZONES}
                    onChange={(value) => setEditForm({ ...editForm, timezone: value })}
                  />
                </div>

                {/* 2FA Status & Admin Management */}
                <div className="toggle-field twofa-management-field">
                  <div className="toggle-field-label">
                    <span className="toggle-title">Two-Factor Authentication (2FA)</span>
                    <span className="toggle-sub">
                      {selectedUser.two_factor_enabled
                        ? 'Active — account protected by two-factor authentication'
                        : 'Two-factor authentication is disabled. 2FA can only be enabled by the user in their own profile settings.'}
                    </span>
                  </div>
                  <div className="twofa-action-controls">
                    {selectedUser.two_factor_enabled ? (
                      <div className="twofa-status-group">
                        <span className="badge-2fa-status enabled">
                          <ShieldCheck size={13} />
                          <span>Active</span>
                        </span>
                        {canDisable2FA && (
                          <button
                            type="button"
                            className="btn-disable-2fa-action"
                            onClick={() => handleDisable2FA(selectedUser.id, selectedUser.email)}
                            title="Disable 2FA for this user"
                          >
                            <ShieldOff size={13} />
                            <span>Disable 2FA</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="twofa-status-group">
                        <span className="badge-2fa-status disabled">
                          <ShieldAlert size={13} />
                          <span>Disabled</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Granular Rights Checklist */}
                <div className="rights-section-header">
                  <span>Authorized Rights & Permissions</span>
                  <button
                    type="button"
                    className="quick-rights-toggle"
                    onClick={() => {
                      const allIds = AVAILABLE_RIGHTS.map((r) => r.id);
                      const hasAll = allIds.every((id) => editForm.permissions.includes(id));
                      setEditForm({
                        ...editForm,
                        permissions: hasAll ? [] : allIds,
                      });
                    }}
                  >
                    Toggle All
                  </button>
                </div>

                <div className="rights-checklist-grid">
                  {AVAILABLE_RIGHTS.map((r) => {
                    const isChecked = editForm.permissions.includes(r.id);
                    return (
                      <label key={r.id} className="right-checkbox-item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleEditPermission(r.id)}
                        />
                        <span>{r.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 3. BULK UPLOAD CSV DRAWER */}
      {isBulkUploadModalOpen && (
        <div className="modal-overlay" onClick={handleCloseBulkUpload}>
          <div
            className="modal-content modal-bulk-upload"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Bulk Upload Users from CSV"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 className="modal-title">
                  <UploadCloud size={20} className="modal-title-icon" />
                  <span>Bulk Upload Users (CSV)</span>
                </h2>
                <p className="modal-subtitle">
                  Import multiple user accounts at once by uploading a formatted CSV spreadsheet.
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={handleCloseBulkUpload}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body bulk-upload-body">
              {/* Requirements & Template Info Card */}
              <div className="csv-requirements-card">
                <div className="csv-req-header">
                  <FileSpreadsheet size={18} className="req-header-icon" />
                  <strong>CSV File Requirements & Column Headers</strong>
                </div>
                <div className="csv-req-content">
                  <p className="csv-req-desc">
                    Your CSV file must have a header row with the following column names:
                  </p>
                  <ul className="csv-req-list">
                    <li>
                      <span className="req-pill required">Required</span>
                      <code>first_name</code> — User's first name
                    </li>
                    <li>
                      <span className="req-pill required">Required</span>
                      <code>email</code> — Valid and unique email address
                    </li>
                    <li>
                      <span className="req-pill optional">Optional</span>
                      <code>last_name</code> — User's last name
                    </li>
                    <li>
                      <span className="req-pill optional">Optional</span>
                      <code>phone_number</code> — Phone number (e.g. +1 555-0199)
                    </li>
                    <li>
                      <span className="req-pill optional">Optional</span>
                      <code>role</code> — <code>user</code> (default), <code>admin</code>, <code>global_admin</code>, <code>super_admin</code>
                    </li>
                    <li>
                      <span className="req-pill optional">Optional</span>
                      <code>status</code> — <code>active</code> (default), <code>inactive</code>, <code>suspended</code>
                    </li>
                    <li>
                      <span className="req-pill optional">Optional</span>
                      <code>timezone</code> — Timezone identifier (defaults to <code>UTC</code>)
                    </li>
                    <li>
                      <span className="req-pill optional">Optional</span>
                      <code>password</code> — Initial password (defaults to <code>Password@123</code>)
                    </li>
                  </ul>
                </div>
                <div className="csv-template-download-row">
                  <button
                    type="button"
                    className="download-template-btn"
                    onClick={downloadSampleCSV}
                  >
                    <Download size={14} />
                    <span>Download Sample CSV Template</span>
                  </button>
                  <span className="template-hint">Pre-filled with correct required headers & example rows.</span>
                </div>
              </div>

              {/* Drag & Drop Upload Zone */}
              <div
                className={`csv-dropzone ${dragActive ? 'drag-active' : ''} ${csvFile ? 'has-file' : ''}`}
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleCSVFileChange(e.dataTransfer.files[0]);
                  }
                }}
              >
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleCSVFileChange(e.target.files[0]);
                    }
                  }}
                />
                <label htmlFor="csv-file-input" className="dropzone-label">
                  <UploadCloud size={36} className="dropzone-icon" />
                  <div className="dropzone-text">
                    {csvFile ? (
                      <>
                        <span className="dropzone-filename">{csvFile.name}</span>
                        <span className="dropzone-filesize">
                          ({(csvFile.size / 1024).toFixed(1)} KB) — Click or drop another file to replace
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="dropzone-primary-text">
                          <strong>Click to select a CSV file</strong> or drag & drop here
                        </span>
                        <span className="dropzone-hint">
                          Only standard .csv files with required headers ("first_name", "email") are supported
                        </span>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* Validation / Parsing Error */}
              {csvError && (
                <div className="csv-error-banner">
                  <XCircle size={18} />
                  <span>{csvError}</span>
                </div>
              )}

              {/* Results from backend after upload */}
              {bulkResult && (
                <div className="bulk-result-card">
                  <div className="bulk-result-header">
                    <CheckCircle2 size={18} className="text-success" />
                    <strong>Upload Complete: {bulkResult.successCount || 0} user(s) created</strong>
                  </div>
                  {bulkResult.errors && bulkResult.errors.length > 0 && (
                    <div className="bulk-result-errors">
                      <span className="errors-title">The following row(s) failed validation:</span>
                      <ul className="errors-list">
                        {bulkResult.errors.map((err, idx) => (
                          <li key={idx}>
                            Row {err.row}: <strong>{err.email || 'User'}</strong> — {err.reason || err.error || 'Failed to import'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table if CSV rows parsed */}
              {csvData.length > 0 && (
                <div className="csv-preview-section">
                  <div className="csv-preview-header">
                    <span className="preview-title">
                      Data Preview ({csvData.length} total rows,{' '}
                      <strong className="text-success">{csvData.filter((r) => r.isValid).length} valid</strong>
                      {csvData.some((r) => !r.isValid) && (
                        <span className="text-danger">
                          , {csvData.filter((r) => !r.isValid).length} with errors
                        </span>
                      )}
                      )
                    </span>
                    <span className="preview-sub">Only valid rows will be imported to the system.</span>
                  </div>

                  <div className="csv-preview-table-container">
                    <table className="csv-preview-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>First Name*</th>
                          <th>Last Name</th>
                          <th>Email*</th>
                          <th>Phone Number</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Timezone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.map((row) => (
                          <tr key={row.rowNum} className={row.isValid ? 'row-valid' : 'row-invalid'}>
                            <td>
                              {row.isValid ? (
                                <span className="csv-badge valid" title="Valid record">
                                  <CheckCircle2 size={12} /> Valid
                                </span>
                              ) : (
                                <span className="csv-badge invalid" title={row.errorMsg}>
                                  <XCircle size={12} /> {row.errorMsg}
                                </span>
                              )}
                            </td>
                            <td><strong>{row.first_name || '—'}</strong></td>
                            <td>{row.last_name || '—'}</td>
                            <td>{row.email || '—'}</td>
                            <td>{row.phone_number || '—'}</td>
                            <td><span className="preview-role-pill">{row.role}</span></td>
                            <td>{row.status}</td>
                            <td>{row.timezone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseBulkUpload}
                disabled={bulkUploading}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBulkUploadSubmit}
                disabled={bulkUploading || csvData.length === 0 || csvData.filter((r) => r.isValid).length === 0}
              >
                <Upload size={15} />
                <span>
                  {bulkUploading
                    ? 'Importing Users...'
                    : `Upload ${csvData.filter((r) => r.isValid).length} Valid Users`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Primary Confirmation Modal */}
      {isTransferModalOpen && transferTargetUser && (
        <div className="modal-overlay" onClick={() => !transferSubmitting && setIsTransferModalOpen(false)}>
          <div
            className="modal-content modal-transfer-primary"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Transfer Primary Super Admin Tag"
          >
            <div className="modal-header">
              <div className="transfer-modal-header-title">
                <div className="transfer-header-icon">
                  <Zap size={18} fill="currentColor" />
                </div>
                <div>
                  <h2 className="modal-title">Transfer Primary Tag</h2>
                  <p className="modal-subtitle">Reassign supreme system authority to another Super Admin</p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => !transferSubmitting && setIsTransferModalOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferPrimarySubmit} className="transfer-modal-body">
              {/* Target User Info Card */}
              <div className="transfer-target-card">
                <div className="transfer-target-avatar">
                  {(transferTargetUser.first_name?.[0] || transferTargetUser.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="transfer-target-info">
                  <div className="transfer-target-name">
                    {[transferTargetUser.first_name, transferTargetUser.last_name].filter(Boolean).join(' ') || 'Super Admin'}
                  </div>
                  <div className="transfer-target-email">{transferTargetUser.email}</div>
                  <div className="transfer-target-role-flow">
                    <span className="badge-role super_admin">SUPER ADMIN</span>
                    <span className="transfer-arrow">&rarr;</span>
                    <span className="profile-primary-badge">
                      <Zap size={11} strokeWidth={2.4} fill="currentColor" />
                      <span>Primary Super Admin</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Notice Box */}
              <div className="transfer-warning-box">
                <AlertTriangle size={18} className="transfer-warning-icon" />
                <div className="transfer-warning-text">
                  <div className="transfer-warning-title">Irreversible Ownership Transfer</div>
                  <p>
                    Transferring the Primary tag to <strong>{transferTargetUser.first_name || transferTargetUser.email}</strong> will make them the supreme administrator of the entire portal.
                  </p>
                  <p>
                    Your account will automatically be demoted to a regular Super Admin. You will forfeit exclusive Primary Admin locks and rights.
                  </p>
                </div>
              </div>

              {/* Security Confirmation Input */}
              <div className="transfer-confirmation-field">
                <label htmlFor="transfer-confirm-input">
                  To confirm, type <strong>TRANSFER</strong> below:
                </label>
                <input
                  id="transfer-confirm-input"
                  type="text"
                  className="form-input"
                  placeholder="TRANSFER"
                  value={transferConfirmText}
                  onChange={(e) => setTransferConfirmText(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  required
                />
              </div>

              <div className="modal-footer transfer-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={transferSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-confirm-transfer"
                  disabled={transferConfirmText.trim().toUpperCase() !== 'TRANSFER' || transferSubmitting}
                >
                  <Zap size={14} fill="currentColor" />
                  <span>{transferSubmitting ? 'Transferring Authority...' : 'Confirm Transfer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
