import { useIncidentList } from './useIncidentList';
import {
  useSubmitIncident,
  viewForSubmitOutcome,
  type SubmitOutcome,
  type SubmitResult
} from './useSubmitIncident';
import { useIncidentSync } from './useIncidentSync';

export type { SubmitOutcome, SubmitResult };
export { viewForSubmitOutcome };

/**
 * Ranger incident flow state (thin composition facade over focused hooks).
 * Screens keep depending on this single hook so screen code stays minimal:
 * - useIncidentList: load/refresh the on-device list (IncidentDB reads)
 * - useSubmitIncident: offline-first submit, retry, submit errors
 *   (DeviceServices + ReportValidator outcome mapping)
 * - useIncidentSync: Sync Now, auto-sync on reconnect, sync banner
 *   (SyncService)
 */
export function useRangerIncidents(token: string | null) {
  const { incidents, loading, refresh } = useIncidentList();
  const { submitting, submitError, submitReport, retryReport, clearSubmitError } =
    useSubmitIncident(token, refresh);
  const { syncing, syncError, syncNow, clearSyncError } = useIncidentSync(token, refresh);

  return {
    incidents,
    loading,
    syncing,
    submitting,
    submitError,
    syncError,
    refresh,
    submitReport,
    retryReport,
    syncNow,
    clearSubmitError,
    clearSyncError
  };
}
