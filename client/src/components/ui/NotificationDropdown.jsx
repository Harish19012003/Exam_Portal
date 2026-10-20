import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Shield,
  Sparkles,
  Info,
  Clock,
  X,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { useNotifications, useMarkNotificationRead } from '../../hooks/useDataUpdates';
import './NotificationDropdown.css';

const DEFAULT_SYSTEM_NOTIFICATIONS = [
  {
    id: 'sys-notif-1',
    type: 'security',
    title: 'Two-Factor Authentication',
    message: 'Protect your account by enabling Google or Microsoft Authenticator in Security settings.',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    is_read: false,
    link: '/profile',
    linkLabel: 'Configure 2FA',
  },
  {
    id: 'sys-notif-2',
    type: 'system',
    title: 'Option A Dynamic Table Live',
    message: 'Dynamic table with smart aggregations, formula editor, and export capabilities is ready.',
    created_at: new Date(Date.now() - 1000 * 60 * 65).toISOString(), // 1 hour ago
    is_read: false,
    link: '/tables',
    linkLabel: 'View Table',
  },
  {
    id: 'sys-notif-3',
    type: 'info',
    title: 'Session Started',
    message: 'Signed in securely as Primary Administrator.',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    is_read: true,
  },
];

export const NotificationDropdown = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const dropdownRef = useRef(null);

  // Load from backend hook
  const { data: remoteNotifications } = useNotifications();
  const { mutate: markRemoteRead } = useMarkNotificationRead();

  // Local notifications state (combines remote notifications or uses rich system defaults)
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('local_notifications');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_SYSTEM_NOTIFICATIONS;
  });

  // Sync with remote notifications if provided
  useEffect(() => {
    if (Array.isArray(remoteNotifications) && remoteNotifications.length > 0) {
      setNotifications((prev) => {
        const merged = [...remoteNotifications];
        // add system notifications if not already present
        DEFAULT_SYSTEM_NOTIFICATIONS.forEach((def) => {
          if (!merged.some((m) => m.id === def.id)) {
            merged.push(def);
          }
        });
        return merged;
      });
    }
  }, [remoteNotifications]);

  // Persist local notifications state
  useEffect(() => {
    localStorage.setItem('local_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    if (!id.toString().startsWith('sys-')) {
      markRemoteRead?.(id);
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.is_read;
    return true;
  });

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Recent';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'security':
        return <Shield size={16} className="notif-icon-security" />;
      case 'system':
        return <Sparkles size={16} className="notif-icon-system" />;
      default:
        return <Info size={16} className="notif-icon-info" />;
    }
  };

  return (
    <div className="notif-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`topbar-icon-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge-pill" aria-label={`${unreadCount} unread`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-popover">
          {/* Header */}
          <div className="notif-header">
            <div className="notif-header-title">
              <h3>Notifications</h3>
              {unreadCount > 0 ? (
                <span className="notif-unread-count-tag">{unreadCount} new</span>
              ) : (
                <span className="notif-all-read-tag">All read</span>
              )}
            </div>

            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-mark-read-btn"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                className="notif-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="notif-tabs">
            <button
              type="button"
              className={`notif-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`notif-tab ${activeTab === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List */}
          <div className="notif-list">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notif-item ${notif.is_read ? 'read' : 'unread'}`}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                >
                  <div className="notif-icon-col">
                    <div className={`notif-type-icon ${notif.type || 'info'}`}>
                      {getNotificationIcon(notif.type)}
                    </div>
                  </div>

                  <div className="notif-body-col">
                    <div className="notif-item-header">
                      <span className="notif-item-title">{notif.title || 'Notification'}</span>
                      <span className="notif-item-time">
                        <Clock size={11} />
                        <span>{formatRelativeTime(notif.created_at)}</span>
                      </span>
                    </div>

                    <p className="notif-item-desc">{notif.message}</p>

                    {notif.link && (
                      <button
                        type="button"
                        className="notif-action-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                          setIsOpen(false);
                          navigate(notif.link);
                        }}
                      >
                        <span>{notif.linkLabel || 'Open'}</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>

                  {!notif.is_read && (
                    <div className="notif-unread-dot" title="Unread notification"></div>
                  )}
                </div>
              ))
            ) : (
              <div className="notif-empty-state">
                <div className="notif-empty-icon">
                  <Check size={24} />
                </div>
                <h4>All caught up!</h4>
                <p>
                  {activeTab === 'unread'
                    ? 'You have no unread notifications.'
                    : 'There are no notifications to display.'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="notif-footer">
              <button
                type="button"
                className="notif-clear-btn"
                onClick={clearAll}
              >
                <Trash2 size={13} />
                <span>Clear all</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
