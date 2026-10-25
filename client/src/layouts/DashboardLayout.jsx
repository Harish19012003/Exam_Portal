import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useSocketManager } from '../hooks/useSocket';
import { apiClient } from '../api/client';
import { NetworkIndicator } from '../components/ui/NetworkIndicator';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import {
  LayoutDashboard,
  LayoutGrid,
  FileText,
  GraduationCap,
  Database,
  DatabaseZap,
  TableProperties,
  Table2,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  LogOut,
  ChevronRight,
  User,
  UserCheck,
  Shield,
  Sun,
  Moon,
  Settings,
  Settings2,
  Zap,
} from 'lucide-react';
import './DashboardLayout.css';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    activeIcon: LayoutGrid,
    end: true,
  },
  {
    to: '/exams',
    label: 'Exams',
    icon: FileText,
    activeIcon: GraduationCap,
  },
  {
    to: '/vendors',
    label: 'Vendor Data',
    icon: Database,
    activeIcon: DatabaseZap,
  },
  {
    to: '/tables',
    label: 'Dynamic Table',
    icon: TableProperties,
    activeIcon: Table2,
  },
];

export const DashboardLayout = () => {
  // Initialize and hold the global socket connection
  useSocketManager();
  const navigate = useNavigate();
  const location = useLocation();
  const avatarRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(true);
  // Pages with a drill-down (e.g. /exams/:id) set the trailing breadcrumb label here.
  const [breadcrumbTail, setBreadcrumbTail] = useState(null);
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

  // Handle dark mode toggle (data-theme for app CSS + .dark for Tailwind dark: variants)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
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
    if (/^\/exams\/[^/]+$/.test(path)) {
      return { label: 'Exams', icon: GraduationCap, to: '/exams', tail: breadcrumbTail || 'Exam' };
    }
    if (path === '/dashboard/exams' || path === '/exams') {
      return { label: 'Exams', icon: GraduationCap };
    }
    if (path === '/dashboard/vendors' || path === '/vendors') {
      return { label: 'Vendor Data', icon: DatabaseZap };
    }
    if (path === '/dashboard/users' || path === '/users') {
      return { label: 'Settings / Users & Roles', icon: Users };
    }
    if (path === '/dashboard/tables' || path === '/tables') {
      return { label: 'Dynamic Table', icon: Table2 };
    }
    if (path === '/dashboard/profile' || path === '/profile') {
      return { label: 'Profile & Security', icon: UserCheck };
    }
    if (path === '/settings' || path.startsWith('/settings')) {
      if (location.search.includes('tab=users')) {
        return { label: 'Settings / Users & Roles', icon: Users };
      }
      return { label: 'Settings', icon: Settings2 };
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
            <nav className="nav-list" aria-label="Main Navigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const ActiveIcon = item.activeIcon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    title={item.label}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="nav-active-pill" aria-hidden="true" />}
                        <span className={`nav-icon-wrap ${isActive ? 'active' : ''}`}>
                          {isActive ? (
                            <ActiveIcon className="nav-icon active-icon" size={18} strokeWidth={2.2} />
                          ) : (
                            <Icon className="nav-icon" size={18} strokeWidth={1.8} />
                          )}
                        </span>
                        {isExpanded && <span className="nav-label">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                );
              })}
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
            {({ isActive }) => (
              <>
                {isActive && <span className="nav-active-pill" aria-hidden="true" />}
                <span className={`nav-icon-wrap ${isActive ? 'active' : ''}`}>
                  {isActive ? (
                    <Settings2 size={18} className="sidebar-settings-icon active-icon" strokeWidth={2.2} />
                  ) : (
                    <Settings size={18} className="sidebar-settings-icon" strokeWidth={1.8} />
                  )}
                </span>
                {isExpanded && <span className="nav-label">Settings</span>}
              </>
            )}
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
                      <Zap size={11} strokeWidth={2.4} fill="currentColor" />
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
                  {currentBreadcrumb.to ? (
                    <>
                      <Link to={currentBreadcrumb.to} className="topbar-breadcrumb-link">
                        {currentBreadcrumb.icon && <currentBreadcrumb.icon size={15} />}
                        <span>{currentBreadcrumb.label}</span>
                      </Link>
                      <ChevronRight size={14} className="topbar-breadcrumb-separator" />
                      <span className="topbar-breadcrumb-current">
                        <span>{currentBreadcrumb.tail}</span>
                      </span>
                    </>
                  ) : (
                    <span className="topbar-breadcrumb-current">
                      {currentBreadcrumb.icon && <currentBreadcrumb.icon size={15} />}
                      <span>{currentBreadcrumb.label}</span>
                    </span>
                  )}
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
          <Outlet context={{ setBreadcrumbTail }} />
        </main>
      </div>
    </div>
  );
};
