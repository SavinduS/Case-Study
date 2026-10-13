import {
  clearStoredIncidents,
  getStoredIncident,
  INCIDENT_STORAGE_KEY,
  INCIDENT_STATUS_LABELS,
  listPendingIncidents,
  listStoredIncidents,
  markIncidentFailed,
  markIncidentSynced,
  MAX_STORED_INCIDENTS,
  newIncidentId,
  removeStoredIncident,
  resetIncidentForRetry,
  saveIncidentOffline,
  statusLabelForIncident,
  StorageFullError,
  updateStoredIncidentDraft
} from '../services/incidentStorage';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';

const AsyncStorage = require('@react-native-async-storage/async-storage');

function incident(overrides: Partial<ValidatedFieldIncident> = {}): ValidatedFieldIncident {
  return {
    capturedAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    incidentType: 'snare_illegal_hunting',
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

  it('saves a report offline with a stable UUID id', async () => {
    const a = await saveIncidentOffline(incident());
    const b = await saveIncidentOffline(incident());
    expect(a.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(b.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(a.id).not.toBe(b.id);
    expect(a.reportId).toBe(a.id);
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

  it('newIncidentId generates stable UUID values', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newIncidentId()));
    expect(ids.size).toBe(20);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }
  });

  it('throws StorageFullError at the storage limit', async () => {
    const many = Array.from({ length: MAX_STORED_INCIDENTS }, (_, i) => ({
      id: `id-${i}`,
      reportId: `id-${i}`,
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

  it('persists server displayId and photo URL only on confirmed sync', async () => {
    const saved = await saveIncidentOffline(incident());
    expect(saved.displayId).toBeNull();
    const updated = await markIncidentSynced(saved.id, {
      displayId: 'FI-2026-0001',
      serverPhotoUrl: '/uploads/photo-abc.jpg'
    });
    expect(updated?.displayId).toBe('FI-2026-0001');
    expect(updated?.serverPhotoUrl).toBe('/uploads/photo-abc.jpg');
    expect((await getStoredIncident(saved.reportId))?.status).toBe('synced');
  });

  it('markIncidentSynced without server info keeps existing server fields', async () => {
    const saved = await saveIncidentOffline(incident());
    await markIncidentSynced(saved.id, { displayId: 'FI-2026-0002' });
    const again = await markIncidentSynced(saved.id);
    expect(again?.displayId).toBe('FI-2026-0002');
  });

  it('updateStoredIncidentDraft preserves the reportId (edit never mints a new ID)', async () => {
    const saved = await saveIncidentOffline(incident());
    await markIncidentFailed(saved.id, 'rejected');
    const updated = await updateStoredIncidentDraft(saved.id, incident({ description: 'fixed' }));
    expect(updated?.id).toBe(saved.id);
    expect(updated?.reportId).toBe(saved.reportId);
    expect(updated?.incident.description).toBe('fixed');
    expect(updated?.status).toBe('pending');
    expect((await listStoredIncidents()).filter((i) => i.reportId === saved.reportId)).toHaveLength(1);
  });

  it('updateStoredIncidentDraft returns null for unknown id', async () => {
    expect(await updateStoredIncidentDraft('missing', incident())).toBeNull();
  });

  it('loads rows missing an id via their reportId and drops unusable rows', async () => {
    const good = {
      id: 'good',
      reportId: 'good',
      incident: incident(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0
    };
    AsyncStorage.__setStore({
      [INCIDENT_STORAGE_KEY]: JSON.stringify([
        good,
        { reportId: 'adopted', incident: incident(), status: 'synced' },
        { incident: incident() },
        null,
        'junk'
      ])
    });
    const list = await listStoredIncidents();
    expect(list.map((i) => i.id).sort()).toEqual(['adopted', 'good']);
    expect(list.find((i) => i.id === 'adopted')?.reportId).toBe('adopted');
  });

  it('coerces unknown statuses to pending instead of dropping the row', async () => {
    AsyncStorage.__setStore({
      [INCIDENT_STORAGE_KEY]: JSON.stringify([
        { id: 'w', reportId: 'w', incident: incident(), status: 'weird' }
      ])
    });
    expect((await listStoredIncidents())[0].status).toBe('pending');
  });

  it('maps internal states to UI labels', () => {
    expect(INCIDENT_STATUS_LABELS).toEqual({
      pending: 'Pending Synchronization',
      synced: 'Synchronized',
      failed: 'Failed'
    });
    expect(statusLabelForIncident('pending')).toBe('Pending Synchronization');
    expect(statusLabelForIncident('synced')).toBe('Synchronized');
    expect(statusLabelForIncident('failed')).toBe('Failed');
  });

  it('a failed save never discards already-stored reports', async () => {
    const before = await saveIncidentOffline(incident());
    AsyncStorage.__failNextSetItem(new Error('QuotaExceededError: full'));
    await expect(saveIncidentOffline(incident())).rejects.toBeInstanceOf(StorageFullError);
    expect(await getStoredIncident(before.id)).not.toBeNull();
    expect(await listStoredIncidents()).toHaveLength(1);
  });
});

