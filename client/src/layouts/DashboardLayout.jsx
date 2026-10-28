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
  Menu,
  ChevronLeft,
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
import './ExamSidebar.css';

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

  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return localStorage.getItem('sidebarExpanded') === 'true';
    } catch {
      return false;
    }
  });
  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      try {
        localStorage.setItem('sidebarExpanded', String(!prev));
      } catch {
        // ignore storage errors
      }
      return !prev;
    });
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);
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
      {/* SIDEBAR (LogicPanda design: dark green, hover-expand on desktop, drawer on mobile) */}
      <div className="xs-shell">
      {mobileOpen && <div className="xs-backdrop" onClick={closeMobile} aria-hidden="true" />}
      <aside className={`xs-sidebar ${isExpanded ? 'expanded' : ''} ${mobileOpen ? 'open' : ''}`}>

        <div className="xs-logo">
          <div className="xs-logo-icon">
            <LayoutGrid size={20} strokeWidth={2.5} />
          </div>
          <span className="xs-logo-text">Exam View</span>
        </div>

        <nav className="xs-nav" aria-label="Main Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeMobile}
                className={({ isActive }) => `xs-nav-item ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <Icon className="xs-nav-icon" size={18} strokeWidth={2} />
                <span className="xs-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="xs-footer">
          <div className="xs-footer-actions">
            <button
              type="button"
              className="xs-icon-btn"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
            </button>
            <NavLink
              to="/settings"
              onClick={closeMobile}
              className={({ isActive }) => `xs-icon-btn ${isActive ? 'active' : ''}`}
              title="Settings"
            >
              <Settings size={18} strokeWidth={2} />
            </NavLink>
          </div>

          <div
            className="xs-profile"
            role="button"
            tabIndex={0}
            title="View & Edit Profile"
            onClick={() => { navigate('/profile'); closeMobile(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { navigate('/profile'); closeMobile(); } }}
          >
            <div className="xs-profile-main">
              <div className="xs-avatar">
                {avatarLetter}
                <span className="xs-online" title="Active" />
              </div>
              <div className="xs-user xs-label">
                <span className="xs-user-name" title={displayName}>{displayName}</span>
                <span className="xs-user-role">{isPrimaryAdmin ? 'Primary Admin' : roleDisplay.toLowerCase()}</span>
              </div>
            </div>
            <button
              type="button"
              className="xs-logout"
              title="Log Out"
              onClick={(e) => { e.stopPropagation(); handleLogout(e); }}
            >
              <LogOut size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>
      <button
        type="button"
        className="xs-toggle"
        onClick={toggleSidebar}
        title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={isExpanded}
      >
        {isExpanded ? <ChevronLeft size={14} strokeWidth={2.5} /> : <ChevronRight size={14} strokeWidth={2.5} />}
      </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-container">
        {/* TOP BAR */}
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="xs-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
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
