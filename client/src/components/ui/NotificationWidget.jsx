import React from 'react';
import { useNotifications, useMarkNotificationRead, useAnnouncements } from '../../hooks/useDataUpdates';
import { Skeleton } from './Skeleton';

export const NotificationWidget = () => {
  const { data: notifications, isLoading: isNotifLoading } = useNotifications();
  const { data: announcements, isLoading: isAnnounceLoading } = useAnnouncements();
  const { mutate: markRead } = useMarkNotificationRead();

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '1rem' }}>
      {/* Announcements Panel */}
      <div style={{ flex: 1, padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <h3>Announcements</h3>
        {isAnnounceLoading ? (
          <Skeleton count={3} />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {announcements?.length > 0 ? announcements.map(a => (
              <li key={a.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <strong>{a.title}</strong>
                <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>{a.content}</p>
                <small style={{ color: 'var(--text-tertiary)' }}>By {a.first_name} {a.last_name}</small>
              </li>
            )) : <p>No announcements.</p>}
          </ul>
        )}
      </div>

      {/* Notifications Panel */}
      <div style={{ flex: 1, padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <h3>Your Notifications</h3>
        {isNotifLoading ? (
          <Skeleton count={3} />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notifications?.length > 0 ? notifications.map(n => (
              <li 
                key={n.id} 
                style={{ 
                  marginBottom: '1rem', 
                  padding: '1rem', 
                  backgroundColor: n.is_read ? 'transparent' : 'var(--bg-secondary)',
                  borderRadius: '4px'
                }}
              >
                <p style={{ margin: '0 0 0.5rem 0' }}>{n.message}</p>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
                    Mark as Read
                  </button>
                )}
              </li>
            )) : <p>No notifications.</p>}
          </ul>
        )}
      </div>
    </div>
  );
};
