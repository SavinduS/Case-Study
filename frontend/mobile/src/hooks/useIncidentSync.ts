import { useCallback, useEffect, useRef, useState } from 'react';
import { postFieldIncident } from '../api/fieldIncidents';
import { ConnectivityService } from '../services/connectivity';
import { syncPendingIncidents } from '../services/syncService';

export interface SyncSummary {
  synced: string[];
  failed: { id: string; error: string }[];
  remaining: string[];
}

const EMPTY_SUMMARY: SyncSummary = { synced: [], failed: [], remaining: [] };

/**
 * Pending-report sync (SyncService): manual Sync Now plus automatic
 * flush on every offline -> online transition. A ref guard (not the
 * render-scoped `syncing` state) decides, so a reconnect event and a manual
 * tap can never run two syncs at once. Retry rules live in syncService
 * (3 attempts; network error -> stays Pending; 4xx rejection -> Failed).
 * `refresh` reloads the list after every run.
 */
export function useIncidentSync(token: string | null, refresh: () => Promise<void>) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Render-independent sync guard shared by the listener and Sync Now.
  const syncingRef = useRef(false);

  /** Push all pending reports (Sync Now). Per-item failures are recorded on
   * the row; the summary error is surfaced without losing successes. */
  const syncNow = useCallback(async (): Promise<SyncSummary> => {
    if (!token || syncingRef.current) return { ...EMPTY_SUMMARY };
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const summary = await syncPendingIncidents({
        postIncident: async (incident, item) => {
          if (!item) throw new Error('Missing stored report');
          const res = await postFieldIncident(item.reportId, incident, token);
          return {
            serverId: res.displayId || res.reportId,
            displayId: res.displayId ?? null,
            serverPhotoUrl: res.photo?.path ?? null
          };
        },
        maxRetries: 3,
        retryDelayMs: 0
      });
      await refresh();
      if (summary.remaining.length > 0 || summary.failed.length > 0) {
        setSyncError(
          summary.failed.length > 0
            ? 'Some reports were rejected. Open them to correct and retry.'
            : 'Connection interrupted. Reports remain pending and will retry.'
        );
      }
      return summary;
    } catch {
      setSyncError('Sync failed. Reports remain on this device.');
      return { ...EMPTY_SUMMARY };
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [token, refresh]);

  // Latest syncNow for the connectivity listener (avoids resubscribing on
  // every render while never calling a stale closure).
  const syncNowRef = useRef(syncNow);
  syncNowRef.current = syncNow;

  // Alt Flow 3 auto-sync: every offline -> online transition flushes pending
  // reports through the same guarded path as manual Sync Now.
  useEffect(() => {
    const unsubscribe = ConnectivityService.subscribe((online) => {
      if (online) void syncNowRef.current();
    });
    return unsubscribe;
  }, []);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  return { syncing, syncError, syncNow, clearSyncError };
}
