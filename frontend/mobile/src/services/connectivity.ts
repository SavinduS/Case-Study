import NetInfo from '@react-native-community/netinfo';

/** Connectivity change callback. True = device is back online. */
export type ConnectivityCallback = (online: boolean) => void;

/** Minimal NetInfo state shape this service reads (structural, no type import). */
export interface ConnectivityState {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}

/**
 * Decide online/offline from a NetInfo state. Requires an active connection;
 * when internet reachability is unknown (null) it falls back to the raw
 * connection flag instead of blocking a valid sync.
 */
export function readOnlineState(state: ConnectivityState): boolean {
  if (!state.isConnected) return false;
  return state.isInternetReachable ?? state.isConnected;
}

/**
 * Device connectivity behind a small abstraction (Dependency Inversion):
 * screens and hooks depend on this service, never on NetInfo directly, so
 * tests can drive it through the NetInfo jest mock.
 */
export const ConnectivityService = {
  /** One-shot connectivity check. */
  async isOnline(): Promise<boolean> {
    try {
      return readOnlineState(await NetInfo.fetch());
    } catch {
      return false;
    }
  },

  /**
   * Subscribe to connectivity changes. The callback fires on every change
   * (duplicate consecutive events are ignored); the state observed at
   * subscribe time is the silent baseline, so mounting while online does not
   * count as a reconnect. Callers filter the direction they need (the
   * auto-sync hook only reacts to `online === true`).
   * Returns an unsubscribe function for unmount cleanup.
   */
  subscribe(callback: ConnectivityCallback): () => void {
    let last: boolean | null = null;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = readOnlineState(state);
      if (last === null) {
        last = online;
        return;
      }
      if (online === last) return;
      last = online;
      callback(online);
    });
    return () => unsubscribe();
  }
};
