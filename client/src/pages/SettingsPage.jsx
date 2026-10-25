import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UsersPage } from './UsersPage';
import { MessageTemplatesTab } from './settings/MessageTemplatesTab';
import { ConfigTab } from './settings/ConfigTab';
import { ExamTableConfigTab } from './settings/ExamTableConfigTab';
import {
  Users,
  Mail,
  SlidersHorizontal,
  Table2,
  Search,
  Check,
  ChevronDown,
  Info,
} from 'lucide-react';
import './SettingsPage.css';

const TABS_CONFIG = [
  {
    id: 'users',
    title: 'User Management',
    icon: Users,
    badge: 'Admin',
    badgeType: 'admin',
    adminOnly: true,
    description: 'Manage portal accounts, assign role-based access control, configure granular permissions, and bulk import.',
  },
  {
    id: 'templates',
    title: 'Message Templates',
    icon: Mail,
    badge: '6',
    badgeType: 'orange',
    adminOnly: false,
    description: 'Customizable email & notification templates for OTPs, exams, and alerts.',
  },
  {
    id: 'config',
    title: 'Config',
    icon: SlidersHorizontal,
    badge: null,
    badgeType: 'slate',
    adminOnly: true,
    description: 'Create dropdown lists and other generic settings values used across the portal.',
  },
  {
    id: 'exam-table',
    title: 'Exam table',
    icon: Table2,
    badge: 'Admin',
    badgeType: 'admin',
    adminOnly: true,
    description: 'Shared Exam management fields and Feature Builder config published for all portal members.',
  },
];

export const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read current authenticated user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const isAdmin = useMemo(() => {
    const role = currentUser?.role;
    return role === 'super_admin' || role === 'global_admin' || role === 'admin';
  }, [currentUser]);

  // Filter available tabs
  const availableTabs = useMemo(() => {
    return TABS_CONFIG.filter((t) => !t.adminOnly || isAdmin);
  }, [isAdmin]);

  // Determine active tab
  const urlTab = searchParams.get('tab');
  const initialTab = useMemo(() => {
    if (urlTab && availableTabs.some((t) => t.id === urlTab)) {
      return urlTab;
    }
    return isAdmin ? 'users' : 'templates';
  }, [urlTab, availableTabs, isAdmin]);

  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab state when URL changes
  useEffect(() => {
    if (urlTab && urlTab !== activeTab && availableTabs.some((t) => t.id === urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab, availableTabs, activeTab]);

  const handleTabSelect = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  // Dropdown & Search state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Info Tooltip state
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const infoTooltipRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (infoTooltipRef.current && !infoTooltipRef.current.contains(event.target)) {
        setShowInfoTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Cmd+K or Ctrl+K opens dropdown and focuses search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsDropdownOpen((prev) => {
          const nextState = !prev;
          if (nextState) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }
          return nextState;
        });
      }
      if (e.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
      if (e.key === 'Escape' && showInfoTooltip) {
        setShowInfoTooltip(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen, showInfoTooltip]);

  // Filtered tabs for the dropdown search
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return availableTabs;
    const q = searchQuery.toLowerCase();
    return availableTabs.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [availableTabs, searchQuery]);

  const currentTabConfig = availableTabs.find((t) => t.id === activeTab) || availableTabs[0];
  const CurrentIcon = currentTabConfig.icon;

  return (
    <div className="settings-page">
      {/* TOP TOOLBAR: Left Title & Right-Aligned Tab Selector Dropdown */}
      <div className="settings-top-toolbar">
        {/* Left Side: Section Title with Info Tooltip Icon */}
        <div className="settings-toolbar-left">
          <div className="settings-header-title-group">
            <div className="settings-title-row">
              <h1 className="settings-main-title">{currentTabConfig.title}</h1>
              {currentTabConfig.description && (
                <div
                  className="settings-info-tooltip-wrap"
                  ref={infoTooltipRef}
                  onMouseEnter={() => setShowInfoTooltip(true)}
                  onMouseLeave={() => setShowInfoTooltip(false)}
                >
                  <button
                    type="button"
                    className={`settings-info-btn ${showInfoTooltip ? 'active' : ''}`}
                    onClick={() => setShowInfoTooltip((prev) => !prev)}
                    title={currentTabConfig.description}
                    aria-label={`About ${currentTabConfig.title}`}
                    aria-expanded={showInfoTooltip}
                  >
                    <Info size={15} />
                  </button>
                  {showInfoTooltip && (
                    <div className="settings-info-popover" role="tooltip">
                      <div className="settings-info-popover-header">
                        <Info size={13} className="popover-info-icon" />
                        <span>About {currentTabConfig.title}</span>
                      </div>
                      <p className="settings-info-popover-text">{currentTabConfig.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Dropdown Tab Selector */}
        <div className="settings-toolbar-right" ref={dropdownRef}>
          {/* Lime Green Pill Trigger Button */}
          <div className="settings-dropdown-wrapper">
            <button
              type="button"
              className={`settings-pill-trigger ${isDropdownOpen ? 'open' : ''}`}
              onClick={() => {
                setIsDropdownOpen(!isDropdownOpen);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
            >
              <CurrentIcon size={17} className="pill-icon" />
              <span className="pill-title">{currentTabConfig.title}</span>
              <ChevronDown size={16} className={`pill-chevron ${isDropdownOpen ? 'rotated' : ''}`} />
            </button>

            {/* FLOATING DROPDOWN MENU */}
            {isDropdownOpen && (
              <div className="settings-dropdown-card" role="listbox">
                {/* Search Bar at Top */}
                <div className="settings-dropdown-search-wrap">
                  <Search size={15} className="dropdown-search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="settings-dropdown-search-input"
                    placeholder="Search tabs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="dropdown-search-clear"
                      onClick={() => setSearchQuery('')}
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Tabs List */}
                <div className="settings-dropdown-list">
                  {filteredTabs.length > 0 ? (
                    filteredTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isSelected = tab.id === activeTab;
                      return (
                        <div
                          key={tab.id}
                          className={`settings-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleTabSelect(tab.id)}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="dropdown-item-left">
                            {isSelected ? (
                              <Check size={15} className="dropdown-check-icon" />
                            ) : (
                              <span className="dropdown-check-placeholder"></span>
                            )}
                            <Icon size={16} className="dropdown-tab-icon" />
                            <span className="dropdown-tab-title">{tab.title}</span>
                          </div>

                          {tab.badge && (
                            <span className={`dropdown-badge ${tab.badgeType || 'slate'}`}>
                              {tab.badge}
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="dropdown-empty-state">
                      <span>No matching tabs found</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="settings-tab-viewport">
        {/* 1. USER MANAGEMENT */}
        {activeTab === 'users' && isAdmin && (
          <div className="settings-panel-view">
            <UsersPage embedded={true} />
          </div>
        )}

        {/* 2. MESSAGE TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="settings-panel-view">
            <MessageTemplatesTab />
          </div>
        )}

        {/* 3. CONFIG */}
        {activeTab === 'config' && isAdmin && (
          <div className="settings-panel-view">
            <ConfigTab />
          </div>
        )}

        {/* 4. EXAM TABLE (shared Feature Builder config) */}
        {activeTab === 'exam-table' && isAdmin && (
          <div className="settings-panel-view">
            <ExamTableConfigTab />
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
