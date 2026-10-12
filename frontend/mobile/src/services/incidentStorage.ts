import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';

export type IncidentSyncStatus = 'pending' | 'synced' | 'failed';

export interface StoredFieldIncident {
  id: string;
  incident: ValidatedFieldIncident;
  status: IncidentSyncStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string;
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
  const rand = Math.random().toString(36).slice(2, 10);
  return `local-${Date.now()}-${rand}`;
}

export async function loadStoredIncidents(): Promise<StoredFieldIncident[]> {
  try {
    const raw = await AsyncStorage.getItem(INCIDENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredFieldIncident[];
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

/** Save a validated incident offline with a unique local id. */
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
  const entry: StoredFieldIncident = {
    id: newIncidentId(),
    incident,
    status: 'pending',
    createdAt: incident.capturedAt || now,
    updatedAt: now,
    retryCount: 0
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
  return items.find((i) => i.id === id) ?? null;
}

export async function markIncidentSynced(id: string): Promise<StoredFieldIncident | null> {
  const items = await loadStoredIncidents();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const updated: StoredFieldIncident = {
    ...items[idx],
    status: 'synced',
    updatedAt: new Date().toISOString(),
    lastError: undefined
  };
  const next = [...items];
  next[idx] = updated;
  await persistIncidents(next);
  return updated;
}

export async function markIncidentFailed(id: string, error: string): Promise<void> {
  const items = await loadStoredIncidents();
  const idx = items.findIndex((i) => i.id === id);
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
  const idx = items.findIndex((i) => i.id === id);
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
  await persistIncidents(items.filter((i) => i.id !== id));
}

export async function clearStoredIncidents(): Promise<void> {
  await persistIncidents([]);
}
