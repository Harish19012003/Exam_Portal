import React from 'react';
import { useNetwork } from '../../hooks/useNetwork';
import { WifiOff, AlertTriangle } from 'lucide-react';

export const NetworkIndicator = () => {
  const { isOnline, isSlow } = useNetwork();

  if (isOnline && !isSlow) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      padding: '8px 16px',
      borderRadius: '20px',
      backgroundColor: !isOnline ? 'var(--error-color, #ef4444)' : 'var(--warning-color, #f59e0b)',
      color: 'white',
      fontWeight: '600',
      fontSize: '0.85rem',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    }}>
      {!isOnline ? (
        <>
          <WifiOff size={16} />
          <span>You are Offline</span>
        </>
      ) : (
        <>
          <AlertTriangle size={16} />
          <span>Slow Connection</span>
        </>
      )}
    </div>
  );
};
