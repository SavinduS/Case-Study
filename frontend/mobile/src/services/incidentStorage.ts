import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import { isValidReportId, newReportId } from './reportId';

export type IncidentSyncStatus = 'pending' | 'synced' | 'failed';

export interface StoredFieldIncident {
  /** Stable UUID v4, generated once at first save. Also sent as `reportId`. */
  id: string;
  /** Device-generated unique incident ID (the assignment's unique ID).
   * Always equals `id`; kept as a separate field so the API payload and the
   * local record cannot drift apart. */
  reportId: string;
  incident: ValidatedFieldIncident;
  status: IncidentSyncStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string;
  /** Server-assigned human-readable ID (e.g. FI-2026-0001), set on success. */
  displayId?: string | null;
  /** Server photo location (e.g. /uploads/photo-....jpg), set on success. */
  serverPhotoUrl?: string | null;
}

/** UI labels for the internal sync states. */
export const INCIDENT_STATUS_LABELS: Record<IncidentSyncStatus, string> = {
  pending: 'Pending Synchronization',
  synced: 'Synchronized',
  failed: 'Failed'
};

export function statusLabelForIncident(status: IncidentSyncStatus): string {
  return INCIDENT_STATUS_LABELS[status];
}

export const INCIDENT_STORAGE_KEY = '@wildlife/field-incidents';
export const MAX_STORED_INCIDENTS = 100;

export class StorageFullError extends Error {
  constructor(message = 'Device storage is full. Free space and try again.') {
    super(message);
    this.name = 'StorageFullError';
  }
}

function isStorageFullError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return (
    /quota/i.test(msg) ||
    /storage.*full/i.test(msg) ||
    /ENOSPC/i.test(msg) ||
    /QuotaExceeded/i.test(msg) ||
    /NS_ERROR/i.test(msg)
  );
}

export function newIncidentId(): string {
  // Stable UUID v4 shared with the server as `reportId` (backend validates
  // the UUID shape and dedupes on it). Kept under the legacy name so existing
  // callers keep working.
  return newReportId();
}

function isValidStatus(value: unknown): value is IncidentSyncStatus {
  return value === 'pending' || value === 'synced' || value === 'failed';
}

/** Drop corrupt rows but never throw: a bad row must not hide good ones. */
function sanitizeLoaded(items: unknown): StoredFieldIncident[] {
  if (!Array.isArray(items)) return [];
  const out: StoredFieldIncident[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id =
      (typeof row.id === 'string' && row.id.trim() !== '' && row.id) ||
      (typeof row.reportId === 'string' && row.reportId.trim() !== '' && row.reportId) ||
      null;
    if (!id || !row.incident || typeof row.incident !== 'object') continue;
    const incident = row.incident as ValidatedFieldIncident;
    if (!incident.location || typeof incident.location !== 'object') continue;
    out.push({
      id,
      reportId: typeof row.reportId === 'string' && row.reportId.trim() !== '' ? row.reportId : id,
      incident,
      status: isValidStatus(row.status) ? row.status : 'pending',
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
      retryCount: typeof row.retryCount === 'number' && row.retryCount >= 0 ? row.retryCount : 0,
      lastError: typeof row.lastError === 'string' ? row.lastError : undefined,
      displayId: typeof row.displayId === 'string' ? row.displayId : null,
      serverPhotoUrl: typeof row.serverPhotoUrl === 'string' ? row.serverPhotoUrl : null
    });
  }
  return out;
}

export async function loadStoredIncidents(): Promise<StoredFieldIncident[]> {
  try {
    const raw = await AsyncStorage.getItem(INCIDENT_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeLoaded(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

async function persistIncidents(items: StoredFieldIncident[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INCIDENT_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    if (isStorageFullError(e)) {
      throw new StorageFullError();
    }
    throw e;
  }
}

function sortNewestFirst(items: StoredFieldIncident[]): StoredFieldIncident[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Save a validated incident offline with a stable UUID reportId.
 * The entry is only persisted after it is fully built, so a storage failure
 * never discards the caller's draft (it can retry with the same data). */
export async function saveIncidentOffline(
  incident: ValidatedFieldIncident
): Promise<StoredFieldIncident> {
  const existing = await loadStoredIncidents();
  const pendingCount = existing.filter((i) => i.status === 'pending').length;
  if (existing.length >= MAX_STORED_INCIDENTS || pendingCount >= MAX_STORED_INCIDENTS) {
    throw new StorageFullError(
      `Storage limit reached (${MAX_STORED_INCIDENTS} reports). Sync or remove old reports.`
    );
  }
  const now = new Date().toISOString();
  const reportId = newReportId();
  const entry: StoredFieldIncident = {
    id: reportId,
    reportId,
    incident,
    status: 'pending',
    createdAt: incident.capturedAt || now,
    updatedAt: now,
    retryCount: 0,
    displayId: null,
    serverPhotoUrl: null
  };
  const next = sortNewestFirst([...existing, entry]);
  try {
    await persistIncidents(next);
  } catch (e) {
    if (e instanceof StorageFullError) throw e;
    if (isStorageFullError(e)) throw new StorageFullError();
    throw e;
  }
  return entry;
}

/**
 * Replace the draft of an already-stored report (review -> Edit Report flow).
 * The stable `id`/`reportId` is preserved — editing never mints a new unique
 * ID — and the report returns to `pending` so it will sync again.
 */
export async function updateStoredIncidentDraft(
  id: string,
  incident: ValidatedFieldIncident
): Promise<StoredFieldIncident | null> {
  const items = await loadStoredIncidents();
  const idx = items.findIndex((i) => i.id === id || i.reportId === id);
  if (idx === -1) return null;
  const updated: StoredFieldIncident = {
    ...items[idx],
    incident,
    status: 'pending',
    updatedAt: new Date().toISOString(),
    lastError: undefined
  };
  const next = [...items];
  next[idx] = updated;
  await persistIncidents(next);
  return updated;
}

/** All stored incidents, newest first. */
export async function listStoredIncidents(): Promise<StoredFieldIncident[]> {
  const items = await loadStoredIncidents();
  return sortNewestFirst(items);
}

/** Pending-only subset used by the sync worker. */
export async function listPendingIncidents(): Promise<StoredFieldIncident[]> {
  const items = await loadStoredIncidents();
  return items.filter((i) => i.status === 'pending');
}

export async function getStoredIncident(id: string): Promise<StoredFieldIncident | null> {
  const items = await loadStoredIncidents();
  return items.find((i) => i.id === id || i.reportId === id) ?? null;
}

export interface SyncedServerInfo {
  displayId?: string | null;
  serverPhotoUrl?: string | null;
}

/** Mark synced only after confirmed server success — callers pass the
 * server's displayId/photo URL so they are persisted with the report. */
export async function markIncidentSynced(
  id: string,
  server?: SyncedServerInfo
): Promise<StoredFieldIncident | null> {
  const items = await loadStoredIncidents();
  const idx = items.findIndex((i) => i.id === id || i.reportId === id);
  if (idx === -1) return null;
  const updated: StoredFieldIncident = {
    ...items[idx],
    status: 'synced',
    updatedAt: new Date().toISOString(),
    lastError: undefined,
    displayId: server?.displayId ?? items[idx].displayId ?? null,
    serverPhotoUrl: server?.serverPhotoUrl ?? items[idx].serverPhotoUrl ?? null
  };
  const next = [...items];
  next[idx] = updated;
  await persistIncidents(next);
  return updated;
}

export async function markIncidentFailed(id: string, error: string): Promise<void> {
  const items = await loadStoredIncidents();
  const idx = items.findIndex((i) => i.id === id || i.reportId === id);
  if (idx === -1) return;
  const next = [...items];
  next[idx] = {
    ...next[idx],
    status: 'failed',
    lastError: error,
    retryCount: next[idx].retryCount + 1,
    updatedAt: new Date().toISOString()
  };
  await persistIncidents(next);
}

export async function resetIncidentForRetry(id: string): Promise<void> {
  const items = await loadStoredIncidents();
  const idx = items.findIndex((i) => i.id === id || i.reportId === id);
  if (idx === -1) return;
  const next = [...items];
  next[idx] = {
    ...next[idx],
    status: 'pending',
    lastError: undefined,
    updatedAt: new Date().toISOString()
  };
  await persistIncidents(next);
}

export async function removeStoredIncident(id: string): Promise<void> {
  const items = await loadStoredIncidents();
  await persistIncidents(items.filter((i) => i.id !== id && i.reportId !== id));
}

export async function clearStoredIncidents(): Promise<void> {
  await persistIncidents([]);
}
