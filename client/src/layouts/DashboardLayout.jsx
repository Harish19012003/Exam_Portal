import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useSocketManager } from '../hooks/useSocket';
import { NetworkIndicator } from '../components/ui/NetworkIndicator';
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
} from 'lucide-react';
import './DashboardLayout.css';

export const DashboardLayout = () => {
  // Initialize and hold the global socket connection
  useSocketManager();
  const navigate = useNavigate();
  const avatarRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(true);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
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

  // Close avatar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setIsAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleLogout = (e) => {
    e?.stopPropagation();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setIsAvatarMenuOpen(false);
    navigate('/login');
  };

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
              
              <NavLink to="/dashboard/exams" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Exams">
                <FileText className="nav-icon" size={18} />
                {isExpanded && <span>Exams</span>}
              </NavLink>

              <NavLink to="/dashboard/vendors" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Vendor DataBase">
                <Database className="nav-icon" size={18} />
                {isExpanded && <span>Vendor DataBase</span>}
              </NavLink>

              {(currentUser.role === 'super_admin' || currentUser.role === 'global_admin' || currentUser.role === 'admin') && (
                <NavLink to="/dashboard/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Users & Roles">
                  <Users className="nav-icon" size={18} />
                  {isExpanded && <span>Users & Roles</span>}
                </NavLink>
              )}

              <NavLink to="/dashboard/tables" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Option A Table">
                <TableProperties className="nav-icon" size={18} />
                {isExpanded && <span>Dynamic Table</span>}
              </NavLink>
            </nav>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-container">
        {/* TOP BAR */}
        <header className="topbar">
          <div className="topbar-left">
            {/* Breadcrumbs or other left-aligned topbar items can go here */}
          </div>
          <div className="topbar-right">
            <div className="topbar-time">
              {formatTime(currentTime)}
            </div>
            
            <div className={`custom-theme-toggle ${isDarkMode ? 'dark' : ''}`} onClick={() => setIsDarkMode(!isDarkMode)}>
              <div className="toggle-bg">
                <div className="toggle-icon day-icon">
                  <div className="sun"></div>
                  <div className="cloud"></div>
                </div>
                <div className="toggle-icon night-icon">
                  <div className="moon"></div>
                  <div className="star star-1"></div>
                  <div className="star star-2"></div>
                  <div className="star star-3"></div>
                </div>
              </div>
              <div className="toggle-thumb"></div>
            </div>

            {isPrimaryAdmin && (
              <div className="primary-admin-badge" title="Primary Super Admin with supreme authority">
                <Crown size={14} />
                <span>PRIMARY ADMIN</span>
              </div>
            )}

            <div className="avatar-container" ref={avatarRef}>
              <div
                className="avatar"
                onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                title={`${displayName} (${isPrimaryAdmin ? 'Primary Super Admin' : roleDisplay})`}
              >
                {avatarLetter}
              </div>
              {isAvatarMenuOpen && (
                <div className="avatar-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div className="dropdown-user-info">
                    <div className="user-name">{displayName}</div>
                    <div className="user-email">{currentUser.email || 'user@examview.com'}</div>
                    <div className={`user-role-pill ${isPrimaryAdmin ? 'primary-role' : ''}`}>
                      {isPrimaryAdmin && <Crown size={12} />}
                      <span>{isPrimaryAdmin ? 'PRIMARY SUPER ADMIN' : roleDisplay}</span>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item" onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Logout</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {/* Global network status indicator */}
      <NetworkIndicator />
    </div>
  );
};
