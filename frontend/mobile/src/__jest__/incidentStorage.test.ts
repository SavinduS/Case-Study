import {
  clearStoredIncidents,
  getStoredIncident,
  INCIDENT_STORAGE_KEY,
  listPendingIncidents,
  listStoredIncidents,
  markIncidentFailed,
  markIncidentSynced,
  MAX_STORED_INCIDENTS,
  newIncidentId,
  removeStoredIncident,
  resetIncidentForRetry,
  saveIncidentOffline,
  StorageFullError
} from '../services/incidentStorage';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';

const AsyncStorage = require('@react-native-async-storage/async-storage');

function incident(overrides: Partial<ValidatedFieldIncident> = {}): ValidatedFieldIncident {
  return {
    capturedAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    incidentType: 'snare',
    description: 'snare near trail',
    location: { coordinates: [36.82, -1.29], manual: false },
    photoUri: null,
    ...overrides
  };
}

describe('incidentStorage', () => {
  beforeEach(async () => {
    AsyncStorage.__reset();
  });

  it('saves a report offline with a unique id', async () => {
    const a = await saveIncidentOffline(incident());
    const b = await saveIncidentOffline(incident());
    expect(a.id).toMatch(/^local-/);
    expect(b.id).toMatch(/^local-/);
    expect(a.id).not.toBe(b.id);
    expect(a.status).toBe('pending');
    expect(a.retryCount).toBe(0);
  });

  it('lists stored incidents newest-first', async () => {
    await saveIncidentOffline(incident({ capturedAt: '2026-01-01T00:00:00.000Z' }));
    await saveIncidentOffline(incident({ capturedAt: '2026-06-01T00:00:00.000Z' }));
    const list = await listStoredIncidents();
    expect(list).toHaveLength(2);
    expect(list[0].createdAt >= list[1].createdAt).toBe(true);
  });

  it('listPendingIncidents returns only pending', async () => {
    const p = await saveIncidentOffline(incident());
    await saveIncidentOffline(incident());
    await markIncidentSynced(p.id);
    const pending = await listPendingIncidents();
    expect(pending).toHaveLength(1);
    expect(pending.every((i) => i.status === 'pending')).toBe(true);
  });

  it('getStoredIncident finds by id and returns null when missing', async () => {
    const saved = await saveIncidentOffline(incident());
    expect((await getStoredIncident(saved.id))?.id).toBe(saved.id);
    expect(await getStoredIncident('nope')).toBeNull();
  });

  it('markIncidentSynced flips pending -> synced', async () => {
    const saved = await saveIncidentOffline(incident());
    const updated = await markIncidentSynced(saved.id);
    expect(updated?.status).toBe('synced');
    expect((await getStoredIncident(saved.id))?.status).toBe('synced');
  });

  it('markIncidentSynced returns null for unknown id', async () => {
    expect(await markIncidentSynced('missing')).toBeNull();
  });

  it('markIncidentFailed records error and bumps retryCount', async () => {
    const saved = await saveIncidentOffline(incident());
    await markIncidentFailed(saved.id, 'boom');
    const got = await getStoredIncident(saved.id);
    expect(got?.status).toBe('failed');
    expect(got?.lastError).toBe('boom');
    expect(got?.retryCount).toBe(1);
  });

  it('markIncidentFailed on unknown id is a no-op', async () => {
    await expect(markIncidentFailed('x', 'e')).resolves.toBeUndefined();
  });

  it('resetIncidentForRetry moves failed back to pending', async () => {
    const saved = await saveIncidentOffline(incident());
    await markIncidentFailed(saved.id, 'net down');
    await resetIncidentForRetry(saved.id);
    const got = await getStoredIncident(saved.id);
    expect(got?.status).toBe('pending');
    expect(got?.lastError).toBeUndefined();
  });

  it('removeStoredIncident deletes the entry', async () => {
    const saved = await saveIncidentOffline(incident());
    await removeStoredIncident(saved.id);
    expect(await getStoredIncident(saved.id)).toBeNull();
  });

  it('clearStoredIncidents empties storage', async () => {
    await saveIncidentOffline(incident());
    await clearStoredIncidents();
    expect(await listStoredIncidents()).toEqual([]);
  });

  it('newIncidentId generates unique values', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newIncidentId()));
    expect(ids.size).toBe(20);
  });

  it('throws StorageFullError at the storage limit', async () => {
    const many = Array.from({ length: MAX_STORED_INCIDENTS }, (_, i) => ({
      id: `id-${i}`,
      incident: incident(),
      status: 'pending' as const,
      createdAt: new Date(Date.now() + i).toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0
    }));
    AsyncStorage.__setStore({ [INCIDENT_STORAGE_KEY]: JSON.stringify(many) });
    await expect(saveIncidentOffline(incident())).rejects.toBeInstanceOf(StorageFullError);
  });

  it('maps quota errors from AsyncStorage to StorageFullError', async () => {
    AsyncStorage.__failNextSetItem(new Error('QuotaExceededError: storage quota exceeded'));
    await expect(saveIncidentOffline(incident())).rejects.toBeInstanceOf(StorageFullError);
  });

  it('returns [] when stored JSON is corrupted', async () => {
    AsyncStorage.__setStore({ [INCIDENT_STORAGE_KEY]: 'not-json{{{' });
    expect(await listStoredIncidents()).toEqual([]);
  });

  it('returns [] when stored value is not an array', async () => {
    AsyncStorage.__setStore({ [INCIDENT_STORAGE_KEY]: JSON.stringify({ nope: true }) });
    expect(await listStoredIncidents()).toEqual([]);
  });

  it('rethrows non-quota persistence errors', async () => {
    AsyncStorage.__failNextSetItem(new Error('weird disk failure'));
    await expect(saveIncidentOffline(incident())).rejects.toThrow('weird disk failure');
  });
});

