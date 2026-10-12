import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import {
  listPendingIncidents,
  markIncidentFailed,
  markIncidentSynced,
  saveIncidentOffline,
  type StoredFieldIncident
} from './incidentStorage';

export interface SubmitDeps {
  /** True when the device currently has connectivity. */
  isOnline: () => Promise<boolean> | boolean;
  /** Direct POST of one incident; resolves with the server id. */
  postIncident: (incident: ValidatedFieldIncident) => Promise<{ serverId: string }>;
  /** Persist offline (defaults to incidentStorage.saveIncidentOffline). */
  saveOffline?: (incident: ValidatedFieldIncident) => Promise<StoredFieldIncident>;
}

export type SubmitOutcome =
  | { mode: 'online'; serverId: string; stored: StoredFieldIncident }
  | { mode: 'offline'; stored: StoredFieldIncident };

/**
 * Online-first submit: posts directly when online, otherwise saves offline.
 * When an online POST fails with a network error the report is kept offline
 * so no data is lost (retry via syncPendingIncidents).
 */
export async function submitFieldIncident(
  incident: ValidatedFieldIncident,
  deps: SubmitDeps
): Promise<SubmitOutcome> {
  const save = deps.saveOffline ?? saveIncidentOffline;
  let online = false;
  try {
    online = await deps.isOnline();
  } catch {
    online = false;
  }
  if (!online) {
    const stored = await save(incident);
    return { mode: 'offline', stored };
  }
  try {
    const res = await deps.postIncident(incident);
    const stored = await save(incident);
    await markIncidentSynced(stored.id);
    const synced: StoredFieldIncident = { ...stored, status: 'synced' };
    return { mode: 'online', serverId: res.serverId, stored: synced };
  } catch (e) {
    if (isNetworkError(e)) {
      const stored = await save(incident);
      return { mode: 'offline', stored };
    }
    throw e;
  }
}

export function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  const name = (e as { name?: string })?.name ?? '';
  const msg = e instanceof Error ? e.message : String(e);
  return (
    name === 'NetworkError' ||
    name === 'TypeError' ||
    /network/i.test(msg) ||
    /cannot reach/i.test(msg) ||
    /fetch failed/i.test(msg) ||
    /abort/i.test(msg) ||
    /offline/i.test(msg)
  );
}

export interface SyncDeps {
  listPending?: () => Promise<StoredFieldIncident[]>;
  postIncident: (incident: ValidatedFieldIncident) => Promise<{ serverId: string }>;
  onSynced?: (id: string) => Promise<unknown>;
  onFailed?: (id: string, error: string) => Promise<unknown>;
  /** Max attempts per report (default 3). */
  maxRetries?: number;
  /** Base delay ms between retries (default 0 in tests). */
  retryDelayMs?: number;
  delay?: (ms: number) => Promise<void>;
}

export interface SyncSummary {
  synced: string[];
  failed: { id: string; error: string }[];
  remaining: string[];
}

function defaultDelay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message || 'Sync failed';
  return String(e ?? 'Sync failed');
}

/**
 * Push every pending report to the server with per-report retry.
 * Network failures are retryable; server rejections (4xx validation) are
 * recorded as failed without further retries. Never throws for per-report
 * failures — the summary reports them so the UI can show badges.
 */
export async function syncPendingIncidents(deps: SyncDeps): Promise<SyncSummary> {
  const list = deps.listPending ?? listPendingIncidents;
  const markSynced = deps.onSynced ?? markIncidentSynced;
  const markFailed = deps.onFailed ?? markIncidentFailed;
  const maxRetries = deps.maxRetries ?? 3;
  const baseDelay = deps.retryDelayMs ?? 0;
  const delay = deps.delay ?? defaultDelay;

  const pending = await list();
  const summary: SyncSummary = { synced: [], failed: [], remaining: [] };

  for (const item of pending) {
    let attempt = 0;
    let done = false;
    // biome-ignore lint: retry loop is intentional
    while (attempt < maxRetries && !done) {
      attempt += 1;
      try {
        await deps.postIncident(item.incident);
        await markSynced(item.id);
        summary.synced.push(item.id);
        done = true;
      } catch (e) {
        const message = describeError(e);
        if (!isNetworkError(e)) {
          await markFailed(item.id, message);
          summary.failed.push({ id: item.id, error: message });
          done = true;
        } else if (attempt >= maxRetries) {
          await markFailed(item.id, message);
          summary.remaining.push(item.id);
          done = true;
        } else {
          await delay(baseDelay * attempt);
        }
      }
    }
  }
  return summary;
}
