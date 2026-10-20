import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useSocketManager } from '../hooks/useSocket';
import { apiClient } from '../api/client';
import { NetworkIndicator } from '../components/ui/NetworkIndicator';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import {
  LayoutDashboard,
  FileText,
  Database,
  Users,
  TableProperties,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  LogOut,
  ChevronsUpDown,
  ChevronRight,
  User,
  Shield,
  Sun,
  Moon,
  Settings,
} from 'lucide-react';
import './DashboardLayout.css';

export const DashboardLayout = () => {
  // Initialize and hold the global socket connection
  useSocketManager();
  const navigate = useNavigate();
  const location = useLocation();
  const avatarRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  const isPrimaryAdmin = Boolean(currentUser.is_primary);
  const avatarLetter = (currentUser.first_name?.[0] || currentUser.email?.[0] || 'A').toUpperCase();
  const displayName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.email || 'User';
  const roleDisplay = currentUser.role ? currentUser.role.replace(/_/g, ' ').toUpperCase() : 'USER';

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle dark mode toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleLogout = async (e) => {
    e?.stopPropagation();
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore network errors if server is down or unreachable
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('sessionActive');
      navigate('/login');
    }
  };

  const getBreadcrumb = () => {
    const path = location.pathname.replace(/\/$/, '');
    if (path === '/dashboard/exams' || path === '/exams') {
      return { label: 'Exams', icon: FileText };
    }
    if (path === '/dashboard/vendors' || path === '/vendors') {
      return { label: 'Vendor DataBase', icon: Database };
    }
    if (path === '/dashboard/users' || path === '/users') {
      return { label: 'Settings / Users & Roles', icon: Users };
    }
    if (path === '/dashboard/tables' || path === '/tables') {
      return { label: 'Dynamic Table', icon: TableProperties };
    }
    if (path === '/dashboard/profile' || path === '/profile') {
      return { label: 'Profile & Security', icon: User };
    }
    if (path === '/settings' || path.startsWith('/settings')) {
      if (location.search.includes('tab=users')) {
        return { label: 'Settings / Users & Roles', icon: Users };
      }
      return { label: 'Settings', icon: Settings };
    }
    if (path === '/dashboard/admin' || path === '/admin') {
      return { label: 'Settings / Users & Roles', icon: Shield };
    }
    return null;
  };
  const currentBreadcrumb = getBreadcrumb();

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className={`sidebar ${isExpanded ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="brand-container">
            <div className="logo-icon">E</div>
            {isExpanded && <div className="brand-name">Exam View</div>}
          </div>
          <button className="toggle-btn" onClick={() => setIsExpanded(!isExpanded)} title="Toggle Sidebar">
            {isExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section">
            <nav className="nav-list">
              <NavLink to="/dashboard" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Dashboard">
                <LayoutDashboard className="nav-icon" size={18} />
                {isExpanded && <span>Dashboard</span>}
              </NavLink>
              
              <NavLink to="/exams" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Exams">
                <FileText className="nav-icon" size={18} />
                {isExpanded && <span>Exams</span>}
              </NavLink>

              <NavLink to="/vendors" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Vendor DataBase">
                <Database className="nav-icon" size={18} />
                {isExpanded && <span>Vendor DataBase</span>}
              </NavLink>

              <NavLink to="/tables" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Option A Table">
                <TableProperties className="nav-icon" size={18} />
                {isExpanded && <span>Dynamic Table</span>}
              </NavLink>
            </nav>
          </div>
        </div>

        {/* SIDEBAR FOOTER (SETTINGS & USER PROFILE) */}
        <div className="sidebar-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-settings-link ${isActive ? 'active' : ''}`}
            title="Settings"
          >
            <Settings size={18} className="sidebar-settings-icon" />
            {isExpanded && <span>Settings</span>}
          </NavLink>

          <div
            className={`sidebar-profile-card ${location.pathname === '/profile' || location.pathname === '/dashboard/profile' ? 'active' : ''}`}
            title={!isExpanded ? `${displayName} (Click for Profile)` : "View & Edit Profile"}
            onClick={() => navigate('/profile')}
          >
            <div className="sidebar-avatar-wrap">
              <div className="sidebar-avatar">
                {avatarLetter}
              </div>
              <span className="sidebar-online-status" title="Active"></span>
            </div>

            {isExpanded && (
              <div className="sidebar-user-details">
                <span className="sidebar-user-name" title={displayName}>
                  {displayName}
                </span>
                <div className="sidebar-role-line">
                  {isPrimaryAdmin ? (
                    <span className="sidebar-primary-badge">
                      <Crown size={11} />
                      <span>Primary Admin</span>
                    </span>
                  ) : (
                    <span className="sidebar-role-badge">
                      {roleDisplay}
                    </span>
                  )}
                </div>
              </div>
            )}

            {isExpanded && (
              <button
                type="button"
                className="sidebar-logout-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout(e);
                }}
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-container">
        {/* TOP BAR */}
        <header className="topbar">
          <div className="topbar-left">
            <nav className="topbar-breadcrumbs" aria-label="Breadcrumb">
              <Link to="/dashboard" className="topbar-breadcrumb-link" title="Go to Dashboard">
                <LayoutDashboard size={15} />
                <span>Dashboard</span>
              </Link>
              {currentBreadcrumb && (
                <>
                  <ChevronRight size={14} className="topbar-breadcrumb-separator" />
                  <span className="topbar-breadcrumb-current">
                    {currentBreadcrumb.icon && <currentBreadcrumb.icon size={15} />}
                    <span>{currentBreadcrumb.label}</span>
                  </span>
                </>
              )}
            </nav>
          </div>
          <div className="topbar-right">
            {/* Network connection status indicator (shows when slow or offline) */}
            <NetworkIndicator />

            <div className="topbar-time">
              {formatTime(currentTime)}
            </div>
            
            <div className="topbar-actions-group">
              <button
                type="button"
                className="topbar-icon-btn theme-toggle-btn"
                onClick={() => setIsDarkMode(!isDarkMode)}
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? (
                  <Sun size={18} className="theme-toggle-icon sun-icon" />
                ) : (
                  <Moon size={18} className="theme-toggle-icon moon-icon" />
                )}
              </button>

              {/* Notification Bell with unread badge and dropdown */}
              <NotificationDropdown />
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
