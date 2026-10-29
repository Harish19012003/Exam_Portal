import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageTitle } from '../components/PageHeading';
import { useSearchParams } from 'react-router-dom';
import { UsersPage } from './UsersPage';
import { MessageTemplatesTab } from './settings/MessageTemplatesTab';
import { ConfigTab } from './settings/ConfigTab';
import { ExamTableConfigTab } from './settings/ExamTableConfigTab';
import { useAccess } from '../hooks/useAccess';
import {
  Users,
  Mail,
  SlidersHorizontal,
  Table2,
  Search,
  Check,
  ChevronDown,
} from 'lucide-react';
import './SettingsPage.css';

const TABS_CONFIG = [
  {
    id: 'users',
    title: 'User Management',
    icon: Users,
    badge: 'Admin',
    badgeType: 'admin',
    page: 'users',
    description: 'Manage portal accounts, assign role-based access control, configure granular permissions, and bulk import.',
  },
  {
    id: 'templates',
    title: 'Message Templates',
    icon: Mail,
    badge: '6',
    badgeType: 'orange',
    page: null,
    description: 'Customizable email & notification templates for OTPs, exams, and alerts.',
  },
  {
    id: 'config',
    title: 'Config',
    icon: SlidersHorizontal,
    badge: null,
    badgeType: 'slate',
    page: 'settings',
    description: 'Create dropdown lists and other generic settings values used across the portal.',
  },
  {
    id: 'exam-table',
    title: 'Exam table',
    icon: Table2,
    badge: 'Admin',
    badgeType: 'admin',
    page: 'settings',
    description: 'Shared Exam management fields and Feature Builder config published for all portal members.',
  },
];

export const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs follow the page rights from the user's groups (templates are open to everyone)
  const { canPage, access } = useAccess();
  const availableTabs = useMemo(
    () => TABS_CONFIG.filter((t) => !t.page || canPage(t.page)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [access],
  );
  const showTab = (id) => availableTabs.some((t) => t.id === id);

  // Determine active tab
  const urlTab = searchParams.get('tab');
  const initialTab = useMemo(() => {
    if (urlTab && availableTabs.some((t) => t.id === urlTab)) {
      return urlTab;
    }
    return availableTabs[0]?.id || 'templates';
  }, [urlTab, availableTabs]);

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
  // Empty slot left of the dropdown; the active tab can render its action buttons into it.
  const [actionsSlot, setActionsSlot] = useState(null);
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
    <div className={`settings-page ${activeTab === 'users' ? 'settings-page--fill' : ''}`}>
      {/* TOP TOOLBAR: Left Title & Right-Aligned Tab Selector Dropdown */}
      <div className="settings-top-toolbar">
        {/* Left Side: Section Title with Info Tooltip Icon */}
        <div className="settings-toolbar-left">
          <PageTitle title={currentTabConfig.title} info={currentTabConfig.description} />
        </div>

        {/* Right Side: Dropdown Tab Selector */}
        <div className="settings-toolbar-right" ref={dropdownRef}>
          <div className="settings-toolbar-actions" ref={setActionsSlot} />

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
        {activeTab === 'users' && showTab('users') && (
          <div className="settings-panel-view settings-panel-view--fill">
            <UsersPage embedded={true} actionsSlot={actionsSlot} />
          </div>
        )}

        {/* 2. MESSAGE TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="settings-panel-view">
            <MessageTemplatesTab />
          </div>
        )}

        {/* 3. CONFIG */}
        {activeTab === 'config' && showTab('config') && (
          <div className="settings-panel-view">
            <ConfigTab />
          </div>
        )}

        {/* 4. EXAM TABLE (shared Feature Builder config) */}
        {activeTab === 'exam-table' && showTab('exam-table') && (
          <div className="settings-panel-view">
            <ExamTableConfigTab />
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
