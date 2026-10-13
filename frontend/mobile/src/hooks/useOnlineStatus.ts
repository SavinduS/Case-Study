import { useEffect, useState } from 'react';
import { ConnectivityService } from '../services/connectivity';

/**
 * Live device connectivity for badges and banners. Starts as `null`
 * (unknown) and resolves via ConnectivityService, then follows every
 * connectivity change. Callers treat anything but `true` as offline —
 * the offline-first safe default.
 */
export function useOnlineStatus(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ConnectivityService.isOnline().then((value) => {
      if (!cancelled) setOnline(value);
    });
    // The subscription removes its own listener on cleanup; the flag only
    // guards the one-shot check above.
    const unsubscribe = ConnectivityService.subscribe(setOnline);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return online;
}
