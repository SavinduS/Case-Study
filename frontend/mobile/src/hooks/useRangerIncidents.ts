import { useCallback, useEffect, useState } from 'react';
import { ApiError, pingServer } from '../api/client';
import { postFieldIncident } from '../api/fieldIncidents';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import {
  getStoredIncident,
  listStoredIncidents,
  markIncidentFailed,
  markIncidentSynced,
  saveIncidentOffline,
  StorageFullError,
  updateStoredIncidentDraft,
  type StoredFieldIncident
} from '../services/incidentStorage';
import { isNetworkError, syncPendingIncidents } from '../services/syncService';

export interface SubmitResult {
  stored: StoredFieldIncident;
  /** 'synced' when the server confirmed, 'pending' when kept offline. */
  mode: 'synced' | 'pending';
}

/**
 * Ranger incident flow state. Screens stay presentational: this hook owns
 * loading stored reports, offline-first submit (Alt Flow 3 direct submit when
 * reachable), StorageFullError handling (draft is never lost), and Sync Now.
 * No automatic connectivity listener here (a later step owns NetInfo).
 */
export function useRangerIncidents(token: string | null) {
  const [incidents, setIncidents] = useState<StoredFieldIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIncidents(await listStoredIncidents());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const items = await listStoredIncidents();
        if (!cancelled) setIncidents(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function describeSubmitError(e: unknown): string {
    if (e instanceof StorageFullError) return e.message;
    if (e instanceof ApiError) return String(e.message || 'The report was rejected. Check the highlighted fields.');
    if (e instanceof Error) return e.message || 'Could not save the report. Try again.';
    return 'Could not save the report. Try again.';
  }

  /**
   * Offline-first submit. Persists locally first (new UUID, or the preserved
   * `editingId` for Edit Report), then — only when the server is reachable —
   * posts directly (Alt Flow 3). Network failure keeps the report pending;
   * permanent validation rejection keeps it pending AND returns the message
   * so the UI can offer correction. Never throws for these cases; only
   * storage-capacity failure surfaces via submitError with the draft intact.
   */
  const submitReport = useCallback(
    async (
      incident: ValidatedFieldIncident,
      editingId: string | null
    ): Promise<SubmitResult | { error: string; stored: StoredFieldIncident | null }> => {
      if (!token) return { error: 'You are signed out. Sign in again to submit.', stored: null };
      if (submitting) {
        const current = editingId ? await getStoredIncident(editingId) : null;
        return { error: 'Submission already in progress.', stored: current };
      }
      setSubmitting(true);
      setSubmitError(null);
      try {
        let stored: StoredFieldIncident;
        if (editingId) {
          stored =
            (await updateStoredIncidentDraft(editingId, incident)) ??
            (await saveIncidentOffline(incident));
        } else {
          stored = await saveIncidentOffline(incident);
        }

        let reachable = false;
        try {
          reachable = (await pingServer()).reachable;
        } catch {
          reachable = false;
        }
        if (!reachable) {
          await refresh();
          return { stored: (await getStoredIncident(stored.id)) ?? stored, mode: 'pending' };
        }

        try {
          const res = await postFieldIncident(stored.reportId, incident, token);
          const updated =
            (await markIncidentSynced(stored.id, {
              displayId: res.displayId ?? null,
              serverPhotoUrl: res.photo?.path ?? null
            })) ?? stored;
          await refresh();
          return { stored: updated, mode: 'synced' };
        } catch (e) {
          if (e instanceof ApiError && !isNetworkError(e) && e.status < 500) {
            // Permanent rejection (Exc Flow 1): keep pending for correction.
            await markIncidentFailed(stored.id, String(e.message));
            await refresh();
            return { error: String(e.message), stored: (await getStoredIncident(stored.id)) ?? stored };
          }
          // Network/server failure (Exc Flow 3): keep pending for retry.
          await refresh();
          return { stored: (await getStoredIncident(stored.id)) ?? stored, mode: 'pending' };
        }
      } catch (e) {
        const message = describeSubmitError(e);
        setSubmitError(message);
        const fallback = editingId ? await getStoredIncident(editingId) : null;
        return { error: message, stored: fallback };
      } finally {
        setSubmitting(false);
      }
    },
    [token, submitting, refresh]
  );

  /** Push all pending reports (Sync Now). Per-item failures are recorded on
   * the row; the summary error is surfaced without losing successes. */
  const syncNow = useCallback(async () => {
    if (!token || syncing) return { synced: [] as string[], failed: [] as { id: string; error: string }[], remaining: [] as string[] };
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
      return { synced: [] as string[], failed: [] as { id: string; error: string }[], remaining: [] as string[] };
    } finally {
      setSyncing(false);
    }
  }, [token, syncing, refresh]);

  const clearSubmitError = useCallback(() => setSubmitError(null), []);
  const clearSyncError = useCallback(() => setSyncError(null), []);

  return {
    incidents,
    loading,
    syncing,
    submitting,
    submitError,
    syncError,
    refresh,
    submitReport,
    syncNow,
    clearSubmitError,
    clearSyncError
  };
}
