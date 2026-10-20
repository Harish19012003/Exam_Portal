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

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const checkNetwork = () => {
      if (!navigator.onLine) {
        setIsSlow(false);
        return;
      }
      // Clean, simple detection: slow if explicitly slow-2g or severe RTT latency (>= 2000ms)
      const slow = Boolean(conn && (conn.effectiveType === 'slow-2g' || (conn.rtt && conn.rtt >= 2000)));
      setIsSlow(slow);
    };

    checkNetwork();

    if (conn) {
      conn.addEventListener('change', checkNetwork);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn) {
        conn.removeEventListener('change', checkNetwork);
      }
    };
  }, [addToast]);

  return { isOnline, isSlow };
};
