import React from 'react';
import { useNetwork } from '../../hooks/useNetwork';
import { Wifi, WifiOff } from 'lucide-react';
import './NetworkIndicator.css';

export const NetworkIndicator = () => {
  const { isOnline, isSlow } = useNetwork();

  // If online and speed is normal, don't show any warning
  if (isOnline && !isSlow) return null;

  return (
    <div
      className={`topbar-network-pill ${!isOnline ? 'offline' : 'slow'}`}
      title={
        !isOnline
          ? 'You are currently offline. Actions will be synced when your connection returns.'
          : 'Slow Internet Connection detected. Data requests may take longer.'
      }
    >
      {!isOnline ? (
        <>
          <WifiOff size={14} className="network-pill-icon offline-icon" />
          <span className="network-pill-text">Offline</span>
        </>
      ) : (
        <>
          <Wifi size={14} className="network-pill-icon slow-wifi-icon" />
          <span className="network-pill-text">Slow Connection</span>
        </>
      )}
    </div>
  );
};
