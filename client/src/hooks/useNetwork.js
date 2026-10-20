import { useEffect, useState } from 'react';
import { useToast } from '../components/ui/Toast';

export const useNetwork = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSlow, setIsSlow] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast('Back online!', 'success');
    };

    const handleOffline = () => {
      setIsOnline(false);
      addToast('You are offline. Working in read-only mode.', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API for slow network detection
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    const checkSpeed = () => {
      if (connection) {
        // If effectiveType is 2g or slow-2g, or downlink is very low
        if (connection.effectiveType?.includes('2g') || connection.downlink < 0.5) {
          setIsSlow(true);
        } else {
          setIsSlow(false);
        }
      }
    };

    if (connection) {
      checkSpeed();
      connection.addEventListener('change', checkSpeed);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', checkSpeed);
      }
    };
  }, [addToast]);

  return { isOnline, isSlow };
};
