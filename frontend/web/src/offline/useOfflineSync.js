import { useCallback, useEffect, useState } from 'react';
import { getPendingCount, syncQueue } from './syncQueue.js';

function readOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/**
 * useOfflineSync — online state + pending count + manual retry.
 *
 * Syncs the localStorage queue on app start and whenever the browser fires
 * the "online" event. Returns exactly { isOnline, pendingCount, syncNow }.
 */
export default function useOfflineSync({ autoSync = true } = {}) {
  const [isOnline, setIsOnline] = useState(readOnline);
  const [pendingCount, setPendingCount] = useState(() => {
    try {
      return getPendingCount();
    } catch {
      return 0;
    }
  });

  const refreshCount = useCallback(() => {
    try {
      setPendingCount(getPendingCount());
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    const result = await syncQueue();
    refreshCount();
    return result;
  }, [refreshCount]);

  useEffect(() => {
    if (autoSync && readOnline()) void syncNow().catch(() => {});

    const goOnline = () => {
      setIsOnline(true);
      if (autoSync) void syncNow().catch(() => {});
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('field-incident-queue-change', refreshCount);
    window.addEventListener('storage', refreshCount);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('field-incident-queue-change', refreshCount);
      window.removeEventListener('storage', refreshCount);
    };
  }, [autoSync, refreshCount, syncNow]);

  return { isOnline, pendingCount, syncNow };
}
