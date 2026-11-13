import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppFooter } from '../components/AppFooter/AppFooter';
import { examIdFromUrl, examPath } from '../pages/exams/examUrl';
import { useExamsList } from '../hooks/useExamsQuery';
import { usePlatformSettings } from '../hooks/usePlatformSettings';
import { SectionErrorBoundary } from '../components/ErrorPage/ErrorPage';
import { Megaphone } from 'lucide-react';
import { optimizedAvatarUrl } from '../utils/avatarImage';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useSocketManager } from '../hooks/useSocket';
import { apiClient } from '../api/client';
import { useAccess, clearAccessCache } from '../hooks/useAccess';
import { NetworkIndicator } from '../components/ui/NetworkIndicator';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import {
  LayoutDashboard,
  LayoutGrid,
  FileText,
  CalendarCheck,
  GraduationCap,
  Database,
  DatabaseZap,
  ListOrdered,
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
  MapPin,
  ClipboardList,
  CalendarClock,
  PhoneCall,
  UsersRound,
  Smartphone,
} from 'lucide-react';
import { ExamSwitcher } from './ExamSwitcher';
import { optimizedLogoUrl } from '../utils/brandingImage';
import './DashboardLayout.css';
import './ExamSidebar.css';

/** Shown under "Exams" while an exam is open. */
const EXAM_SUB_ITEMS = [
  { tab: 'center-list', label: 'Center list', icon: MapPin },
  { tab: 'op-guard-list', label: 'Op/Guard List', icon: UsersRound },
  { tab: 'mock-day', label: 'Mock Day', icon: ClipboardList },
  { tab: 'operator-guard-calling', label: 'Op/Guard Calling', icon: PhoneCall },
  { tab: 'exam-day', label: 'Exam Day', icon: CalendarClock },
  { tab: 'device-master', label: 'Device Master', icon: Smartphone },
];

const NAV_ITEMS = [
  {
    to: '/dashboard',
    page: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    activeIcon: LayoutGrid,
    end: true,
  },
  {
    to: '/exams',
    page: 'exams',
    label: 'Exams',
    icon: FileText,
    activeIcon: GraduationCap,
  },
  {
    to: '/vendors',
    page: 'vendors',
    label: 'Vendor Data',
    icon: Database,
    activeIcon: DatabaseZap,
  },
  {
    to: '/seq-view',
    page: 'seq_view',
    label: 'SeqView',
    icon: ListOrdered,
    activeIcon: ListOrdered,
  },
  {
    to: '/tables',
    page: 'tables',
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
  const { ready: accessReady, canPage } = useAccess();
  // Until permissions load, show the full menu; the server still blocks anything not allowed.
  const navItems = accessReady ? NAV_ITEMS.filter((item) => canPage(item.page)) : NAV_ITEMS;
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);
  // Pages with a drill-down (e.g. /exams/:id) set the trailing breadcrumb label here.
  // The label is remembered together with the exam it belongs to, so switching sections of the same
  // exam (which remounts the page) keeps the name on screen instead of flashing "Exam".
  const [tailState, setTailState] = useState({ text: null, forId: null });
  const setBreadcrumbTail = useCallback((text, forId = null) => setTailState({ text, forId }), []);
  // A page can portal its own control into the top bar (left of the clock).
  const [topbarSlot, setTopbarSlot] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Re-read the cached user when the profile page saves (name / photo) so the sidebar updates at once.
  const [, setUserTick] = useState(0);
  useEffect(() => {
    const onUpdated = () => setUserTick((n) => n + 1);
    window.addEventListener('user-profile-updated', onUpdated);
    return () => window.removeEventListener('user-profile-updated', onUpdated);
  }, []);
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
      clearAccessCache();
      navigate('/login');
    }
  };

  const getBreadcrumb = () => {
    const path = location.pathname.replace(/\/$/, '');
    if (/^\/exams\/[^/]+(\/[^/]+)?$/.test(path)) {
      const pageExamId = examIdFromUrl(decodeURIComponent(path.split('/')[2]));
      const tail = tailState.forId === pageExamId ? tailState.text : null;
      return { label: 'Exams', icon: GraduationCap, to: '/exams', tail: tail || 'Exam' };
    }
    if (path === '/dashboard/exams' || path === '/exams') {
      return { label: 'Exams', icon: GraduationCap };
    }
    if (path === '/exam-day') {
      return { label: 'Exam Day', icon: CalendarCheck };
    }
    if (path === '/dashboard/vendors' || path === '/vendors') {
      return { label: 'Vendor Data', icon: DatabaseZap };
    }
    if (path === '/seq-view') {
      return { label: 'SeqView', icon: ListOrdered };
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
  // On /exams/:id the breadcrumb's last part becomes a quick switch between exams.
  const examPageId = /^\/exams\/[^/]+(\/[^/]+)?$/.test(location.pathname.replace(/\/$/, ''))
    ? examIdFromUrl(decodeURIComponent(location.pathname.replace(/\/$/, '').split('/')[2]))
    : null;
  // Remember the last opened exam so the sidebar sections stay usable from other pages.
  const [lastExamId, setLastExamId] = useState(() => {
    try {
      return localStorage.getItem('lastExamId') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (!examPageId) return;
    setLastExamId(examPageId);
    try {
      localStorage.setItem('lastExamId', examPageId);
    } catch {
      // ignore storage errors
    }
  }, [examPageId]);
  // Nothing opened yet in this browser: fall back to the first exam in the (cached) list so the
  // sections are still clickable. Shares the exams-list query key, so no extra request.
  // Platform-wide settings (portal name, maintenance banner). Cached, so no refetch per page.
  const { settings: platform } = usePlatformSettings();
  // Tab title + favicon come from DocumentBranding (works on login too).
  const { data: examsForSidebar } = useExamsList();
  const fallbackExamId = examsForSidebar?.[0]?.id ? String(examsForSidebar[0].id) : '';

  return (
    <div className="layout">
      {/* SIDEBAR (LogicPanda design: dark green, hover-expand on desktop, drawer on mobile) */}
      <div className="xs-shell">
      {mobileOpen && <div className="xs-backdrop" onClick={closeMobile} aria-hidden="true" />}
      <aside className={`xs-sidebar ${isExpanded ? 'expanded' : ''} ${mobileOpen ? 'open' : ''}`}>

        <div className="xs-logo">
          <div className={`xs-logo-icon ${platform.logo_url ? 'has-image' : ''}`}>
            {platform.logo_url ? (
              <img src={optimizedLogoUrl(platform.logo_url)} alt="" />
            ) : (
              <LayoutGrid size={20} strokeWidth={2.5} />
            )}
          </div>
          <span className="xs-logo-text" title={platform.portal_name}>{platform.portal_name}</span>
        </div>

        <nav className="xs-nav" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={closeMobile}
                  className={({ isActive }) => `xs-nav-item ${isActive ? 'active' : ''}${item.page === 'exams' && examPageId ? ' xs-parent-open' : ''}`}
                  title={item.label}
                >
                  <Icon className="xs-nav-icon" size={18} strokeWidth={2} />
                  <span className="xs-label">{item.label}</span>
                </NavLink>
                {item.page === 'exams' && (
                  <div className="xs-subnav" role="group" aria-label="Exam sections">
                    {EXAM_SUB_ITEMS.map((sub) => {
                      const SubIcon = sub.icon;
                      // Without an open exam, use the last one opened; with none, send to the exam list.
                      const targetExam = examPageId || lastExamId || fallbackExamId;
                      const isActive = Boolean(examPageId) && location.pathname.replace(/\/$/, '').endsWith(`/${sub.tab}`);
                      return (
                        <NavLink
                          key={sub.tab}
                          to={targetExam ? examPath(targetExam, sub.tab) : '/exams'}
                          onClick={closeMobile}
                          // Function form stops NavLink adding its own "active" when `to` matches the URL
                          // (all items point at /exams while no exam is open).
                          className={() => `xs-nav-item xs-subnav-item${isActive ? ' active' : ''}${targetExam ? '' : ' xs-subnav-item--idle'}`}
                          title={targetExam ? sub.label : `${sub.label} — pick an exam first`}
                        >
                          <SubIcon className="xs-nav-icon" size={16} strokeWidth={2} />
                          <span className="xs-label">{sub.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
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
                {currentUser.avatar_url ? (
                  <img
                    className="xs-avatar-img"
                    src={optimizedAvatarUrl(currentUser.avatar_url)}
                    alt=""
                    width={32}
                    height={32}
                    decoding="async"
                  />
                ) : (
                  avatarLetter
                )}
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
                      {examPageId ? (
                        <ExamSwitcher examId={examPageId} label={currentBreadcrumb.tail} />
                      ) : (
                        <span className="topbar-breadcrumb-current">
                          <span>{currentBreadcrumb.tail}</span>
                        </span>
                      )}
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

            <div className="topbar-page-slot" ref={setTopbarSlot} />

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

        {platform.maintenance.enabled && platform.maintenance.message && (
          <div className="platform-banner" role="status">
            <Megaphone size={16} aria-hidden="true" />
            <span>{platform.maintenance.message}</span>
          </div>
        )}

        <main className="main-content">
          {/* A crash inside one page shows an error card here; the sidebar and top bar keep working. */}
          <SectionErrorBoundary resetKey={location.pathname}>
            <Outlet context={{ setBreadcrumbTail, topbarSlot }} />
          </SectionErrorBoundary>
        </main>
        <AppFooter />
      </div>
    </div>
  );
};
