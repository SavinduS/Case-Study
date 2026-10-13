import { useCallback, useState } from 'react';
import { ApiError, pingServer } from '../api/client';
import { postFieldIncident } from '../api/fieldIncidents';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import {
  getStoredIncident,
  markIncidentFailed,
  markIncidentSynced,
  saveIncidentOffline,
  updateStoredIncidentDraft,
  type StoredFieldIncident
} from '../services/incidentStorage';
import { isNetworkError } from '../services/syncService';
import { mapSubmitError } from '../services/submitErrors';

export interface SubmitResult {
  stored: StoredFieldIncident;
  /** 'synced' when the server confirmed, 'pending' when kept offline. */
  mode: 'synced' | 'pending';
}

export type SubmitOutcome =
  | SubmitResult
  | { error: string; stored: StoredFieldIncident | null };

/**
 * Navigation policy after a submit attempt (pure, unit-tested): a stored
 * failure goes to the Submit Result screen in its failed state (with Retry);
 * anything without a stored row stays on Review; successes go to Result.
 */
export function viewForSubmitOutcome(outcome: SubmitOutcome): 'result' | 'review' {
  if ('error' in outcome) {
    return outcome.stored && outcome.stored.status === 'failed' ? 'result' : 'review';
  }
  return 'result';
}

/**
 * Offline-first submit (DeviceServices): persists locally first (new UUID,
 * or the preserved `editingId` for Edit Report), then — only when the server
 * is reachable — posts directly (Alt Flow 3). Network failure keeps the
 * report pending; permanent validation rejection keeps it pending AND returns
 * the message so the UI can offer correction. Never throws for these cases;
 * only storage-capacity failure surfaces via submitError with the draft
 * intact. `refresh` reloads the list after every mutation.
 */
export function useSubmitIncident(token: string | null, refresh: () => Promise<void>) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitReport = useCallback(
    async (
      incident: ValidatedFieldIncident,
      editingId: string | null
    ): Promise<SubmitOutcome> => {
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
        const message = mapSubmitError(e);
        setSubmitError(message);
        const fallback = editingId ? await getStoredIncident(editingId) : null;
        return { error: message, stored: fallback };
      } finally {
        setSubmitting(false);
      }
    },
    [token, submitting, refresh]
  );

  /**
   * Retry a stored report with the exact same `reportId` (no duplicate row).
   * Reuses the submit path: the draft is restored to pending, then posted
   * directly when reachable, otherwise kept pending for a later sync.
   */
  const retryReport = useCallback(
    async (stored: StoredFieldIncident): Promise<SubmitOutcome> => {
      return submitReport(stored.incident, stored.id);
    },
    [submitReport]
  );

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  return { submitting, submitError, submitReport, retryReport, clearSubmitError };
}
