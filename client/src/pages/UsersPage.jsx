import React, { useState, useEffect, useMemo } from 'react';
import { UserGroupTabs, UserGroupModal } from './users/UserGroupTabs';
import { PageHeading } from '../components/PageHeading';
import { apiClient } from '../api/client';
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
  Search,
  Plus,
  Check,
  X,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  Phone,
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
} from 'lucide-react';
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

export const UsersPage = ({ embedded = false }) => {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupModal, setGroupModal] = useState(null); // null | { group: object | null }
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter & Sort
  const [searchQuery, setSearchQuery] = useState('');
  // 'all' | 'role:<role>' | 'group:<id>'
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('activity_desc'); // activity_desc, activity_asc, name_asc, name_desc, role, created_desc

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/users');
      setUsers(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ── User groups (custom tabs) ──────────────────────────────────────────────
  const fetchGroups = async () => {
    try {
      const response = await apiClient.get('/users/groups');
      setGroups(response.data.data || []);
    } catch {
      setGroups([]);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

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

  const handleDeleteGroup = async () => {
    const existing = groupModal?.group;
    if (!existing || !window.confirm(`Delete the group "${existing.name}"? The users stay; only the group is removed.`)) return;
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

  // Format relative last activity time
  const formatLastActivity = (timestamp) => {
    if (!timestamp) return { relative: 'Never logged in', full: 'No activity recorded' };
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return { relative: 'Never', full: 'Unknown' };

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    let relative = 'Just now';
    if (diffSec < 60) relative = 'Just now';
    else if (diffMin < 60) relative = `${diffMin}m ago`;
    else if (diffHour < 24) relative = `${diffHour}h ago`;
    else if (diffDay === 1) relative = 'Yesterday';
    else if (diffDay < 7) relative = `${diffDay}d ago`;
    else relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const full = date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return { relative, full };
  };

  // Stats calculation
  const totalUsers = users.length;
  const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
  const adminCount = users.filter((u) => u.role === 'admin' || u.role === 'global_admin').length;
  const twoFaEnabledCount = users.filter((u) => Boolean(u.two_factor_enabled)).length;

  // Filtered and sorted users
  const processedUsers = useMemo(() => {
    let result = [...users];

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.first_name && u.first_name.toLowerCase().includes(q)) ||
          (u.last_name && u.last_name.toLowerCase().includes(q)) ||
          (u.phone_number && u.phone_number.toLowerCase().includes(q)) ||
          (u.timezone && u.timezone.toLowerCase().includes(q))
      );
    }

    // Filter by tab: a role, or a custom group's members
    if (activeTab.startsWith('role:')) {
      const role = activeTab.slice(5);
      result = result.filter((u) => u.role === role);
    } else if (activeTab.startsWith('group:')) {
      const group = groups.find((g) => g.id === activeTab.slice(6));
      const memberIds = new Set((group?.userIds || []).map(String));
      result = result.filter((u) => memberIds.has(String(u.id)));
    }

    // Filter by Status
    if (statusFilter !== 'all') {
      result = result.filter((u) => (u.status || 'active') === statusFilter);
    }

    // Sort users
    result.sort((a, b) => {
      // Primary admin always stays at the very top for safety
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;

      switch (sortBy) {
        case 'activity_desc': {
          const timeA = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
          const timeB = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
          return timeB - timeA;
        }
        case 'activity_asc': {
          const timeA = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
          const timeB = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
          return timeA - timeB;
        }
        case 'name_asc': {
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email;
          return nameA.localeCompare(nameB);
        }
        case 'name_desc': {
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email;
          return nameB.localeCompare(nameA);
        }
        case 'role': {
          const roleWeight = { super_admin: 4, global_admin: 3, admin: 2, user: 1 };
          return (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0);
        }
        case 'created_desc': {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [users, groups, searchQuery, activeTab, statusFilter, sortBy]);

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
    if (!window.confirm(`Are you sure you want to disable 2FA for ${userEmail}?`)) {
      return;
    }
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
      alert('The Primary Super Admin account is protected and cannot be deleted.');
      return;
    }
    if (user.id === currentUser.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete user ${user.first_name || ''} ${user.last_name || ''} (${user.email})?`)) {
      return;
    }

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

  return (
    <div className={`users-page ${embedded ? 'embedded' : ''}`}>
      {/* Top Header (Non-embedded only) */}
      {!embedded && (
        <PageHeading
          title="User & Role Governance"
          info="Manage portal accounts, assign role-based access control, configure granular permissions, and audit last activity."
        />
      )}

      {/* Notifications */}
      {successMsg && (
        <div className="users-alert success">
          <span>{successMsg}</span>
          <button className="modal-close-btn" onClick={() => setSuccessMsg('')}><X size={16} /></button>
        </div>
      )}
      {error && (
        <div className="users-alert error">
          <span>{error}</span>
          <button className="modal-close-btn" onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      <UserGroupTabs
        users={users}
        groups={groups}
        value={activeTab}
        onChange={setActiveTab}
        onCreate={() => setGroupModal({ group: null })}
        onEdit={(group) => setGroupModal({ group })}
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

      {/* Controls Bar: Search, Filters, Sort & Action Icons in One Row */}
      <div className="users-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, email, or timezone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-group">

          {/* Status Filter */}
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>

          {/* Sort By Filter */}
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="activity_desc">Last Activity (Recent First)</option>
            <option value="activity_asc">Last Activity (Oldest First)</option>
            <option value="name_asc">Name (A to Z)</option>
            <option value="name_desc">Name (Z to A)</option>
            <option value="role">Role Priority</option>
            <option value="created_desc">Date Created (Newest)</option>
          </select>

          <div className="users-header-actions">
            {isSuperAdmin && (
              <>
                <span className="users-actions-divider" aria-hidden="true" />
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
        </div>
      </div>

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

      {/* Users Table */}
      <div className="users-table-card">
        <div className="table-responsive">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>2FA Security</th>
                <th>Timezone</th>
                <th
                  className="sortable-th"
                  onClick={() => setSortBy(sortBy === 'activity_desc' ? 'activity_asc' : 'activity_desc')}
                  title="Click to toggle Last Activity sort"
                >
                  <span className="th-content">
                    <span>Last Activity</span>
                    {sortBy === 'activity_desc' && <ArrowDown size={14} />}
                    {sortBy === 'activity_asc' && <ArrowUp size={14} />}
                    {sortBy !== 'activity_desc' && sortBy !== 'activity_asc' && <ArrowUpDown size={14} opacity={0.4} />}
                  </span>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px' }}>
                    Loading user records...
                  </td>
                </tr>
              ) : processedUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px' }}>
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                processedUsers.map((u) => {
                  const initial = (u.first_name?.[0] || u.email?.[0] || 'U').toUpperCase();
                  const isPrimary = Boolean(u.is_primary);
                  const is2FA = Boolean(u.two_factor_enabled);
                  const act = formatLastActivity(u.last_active_at);

                  return (
                    <tr key={u.id}>
                      {/* User Cell */}
                      <td>
                        <div
                          className="user-cell"
                          onClick={() => isSuperAdmin && handleOpenEdit(u)}
                          title={isSuperAdmin ? "Click to edit user" : undefined}
                          style={{ cursor: isSuperAdmin ? 'pointer' : 'default' }}
                        >
                          <div className={`user-avatar-badge ${isPrimary ? 'is-primary' : ''}`}>
                            {initial}
                          </div>
                          <div className="user-name-box">
                            <span className="user-full-name">
                              {[u.first_name, u.last_name].filter(Boolean).join(' ') || 'User'}
                              {isPrimary && (
                                <span className="table-primary-tag" title="Primary Administrator (Root Authority)">
                                  <Zap size={10} strokeWidth={2.4} fill="currentColor" />
                                  <span>Primary</span>
                                </span>
                              )}
                            </span>
                            <span className="user-email-text">{u.email}</span>
                            {u.phone_number && (
                              <span className="user-phone-text">
                                <Phone size={10} />
                                <span>{u.phone_number}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role Cell */}
                      <td>
                        {renderRoleBadge(u.role)}
                      </td>

                      {/* Status Cell */}
                      <td>
                        <span className={`status-indicator ${u.status || 'active'}`}>
                          <span className="status-dot"></span>
                          <span>{(u.status || 'active').toUpperCase()}</span>
                        </span>
                      </td>

                      {/* 2FA Cell */}
                      <td>
                        <div className="twofa-cell">
                          <span className={`badge-2fa ${is2FA ? 'enabled' : 'disabled'}`}>
                            {is2FA ? (
                              <>
                                <ShieldCheck size={12} />
                                <span>2FA ON</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert size={12} />
                                <span>2FA OFF</span>
                              </>
                            )}
                          </span>
                          {is2FA && canDisable2FA && (
                            <button
                              className="btn-disable-2fa-mini"
                              onClick={() => handleDisable2FA(u.id, u.email)}
                              title="Disable 2FA for this user"
                            >
                              Disable
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Timezone Cell */}
                      <td>
                        <span className="timezone-chip" title={`Timezone: ${u.timezone || 'UTC'}`}>
                          <Globe size={13} />
                          <span>{u.timezone || 'UTC'}</span>
                        </span>
                      </td>

                      {/* Last Activity Cell */}
                      <td>
                        <div className="activity-box" title={act.full}>
                          <span className="activity-relative">{act.relative}</span>
                          <span className="activity-date">{act.full}</span>
                        </div>
                      </td>

                      {/* Actions Cell */}
                      <td>
                        <div className="table-actions">
                          {/* Edit User */}
                          {isSuperAdmin && (
                            <button
                              className="action-btn edit"
                              onClick={() => handleOpenEdit(u)}
                              title="Edit user details, role, status, and permissions"
                            >
                              <Pencil size={13} />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Transfer Primary Tag to other Super Admin */}
                          {isPrimaryAdmin && !isPrimary && u.role === 'super_admin' && u.status === 'active' && (
                            <button
                              className="action-btn transfer-primary"
                              onClick={() => handleOpenTransferModal(u)}
                              title={`Transfer Primary Super Admin authority to ${u.first_name || u.email}`}
                              aria-label="Transfer Primary Tag"
                            >
                              <Zap size={13} fill="currentColor" />
                              <span>Transfer</span>
                            </button>
                          )}

                          {/* Delete User */}
                          {isSuperAdmin && (
                            <button
                              className="action-btn delete"
                              onClick={() => handleDeleteUser(u)}
                              disabled={isPrimary || u.id === currentUser.id}
                              title={
                                isPrimary
                                  ? 'Primary Super Admin account is protected'
                                  : u.id === currentUser.id
                                  ? 'Cannot delete own account'
                                  : 'Delete user'
                              }
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
                    <select
                      className="form-select"
                      value={createForm.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setCreateForm({
                          ...createForm,
                          role: newRole,
                          permissions: DEFAULT_ROLE_PERMISSIONS[newRole] || [],
                        });
                      }}
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="global_admin">Global Admin</option>
                      <option value="admin">Admin</option>
                      <option value="user">Standard User</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select
                      className="form-select"
                      value={createForm.status}
                      onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>User Timezone</label>
                  <select
                    className="form-select"
                    value={createForm.timezone}
                    onChange={(e) => setCreateForm({ ...createForm, timezone: e.target.value })}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
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
                    <select
                      className="form-select"
                      value={editForm.role}
                      disabled={selectedUser.is_primary}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setEditForm({
                          ...editForm,
                          role: newRole,
                          permissions: DEFAULT_ROLE_PERMISSIONS[newRole] || [],
                        });
                      }}
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="global_admin">Global Admin</option>
                      <option value="admin">Admin</option>
                      <option value="user">Standard User</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select
                      className="form-select"
                      value={editForm.status}
                      disabled={selectedUser.is_primary}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>User Timezone</label>
                  <select
                    className="form-select"
                    value={editForm.timezone}
                    onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
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
