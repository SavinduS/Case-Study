/**
 * offlineQueue covers the generic report queue (conflict reports).
 * Here we exercise its contract: unique ids, online history, offline
 * enqueue, flush/sync with retry semantics, and storage failure paths.
 */
import { enqueue, flushQueue, listReports, loadQueue, newClientRefId, recordOnlineSuccess } from '../services/offlineQueue';

const AsyncStorage = require('@react-native-async-storage/async-storage');

jest.mock(
  '../api/client',
  () => {
    const actualNetworkError = class NetworkError extends Error {
      constructor(base?: string) {
        super(`Cannot reach the server at ${base ?? 'x'}`);
        this.name = 'NetworkError';
      }
    };
    return {
      NetworkError: actualNetworkError,
      syncReports: jest.fn(),
      uploadPhoto: jest.fn()
    };
  },
  { virtual: false }
);

const api = require('../api/client');

function payload(overrides: any = {}) {
  return {
    incidentType: 'elephant_sighting',
    location: { coordinates: [36.82, -1.29] as [number, number] },
    clientRefId: undefined,
    ...overrides
  };
}

describe('services/offlineQueue', () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    jest.clearAllMocks();
  });

  it('newClientRefId generates unique local ids', () => {
    const ids = new Set(Array.from({ length: 25 }, () => newClientRefId()));
    expect(ids.size).toBe(25);
    for (const id of ids) expect(id).toMatch(/^local-/);
  });

  it('loadQueue returns [] when empty or corrupted', async () => {
    expect(await loadQueue()).toEqual([]);
    AsyncStorage.__setStore({ '@wildlife-alert/conflict-report-queue': 'bad{{' });
    expect(await loadQueue()).toEqual([]);
  });

  it('enqueue stores a PENDING_UPLOAD report offline', async () => {
    const entry = await enqueue(payload());
    expect(entry.clientRefId).toMatch(/^local-/);
    expect(entry.status).toBe('PENDING_UPLOAD');
    expect(entry.payload.clientRefId).toBe(entry.clientRefId);
    const all = await listReports();
    expect(all).toHaveLength(1);
  });

  it('enqueue respects a caller-provided clientRefId', async () => {
    const entry = await enqueue(payload({ clientRefId: 'custom-1' }));
    expect(entry.clientRefId).toBe('custom-1');
  });

  it('recordOnlineSuccess keeps server-accepted reports in history', async () => {
    await recordOnlineSuccess(
      { reportId: 'CR-1', status: 'RECEIVED', submissionMethod: 'online', incidentType: 'elephant_sighting', createdAt: new Date().toISOString() } as any,
      payload()
    );
    const all = await listReports();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('RECEIVED');
    expect(all[0].reportId).toBe('CR-1');
  });

  it('recordOnlineSuccess is idempotent on reportId', async () => {
    const confirmation: any = {
      reportId: 'CR-dup',
      status: 'RECEIVED',
      submissionMethod: 'online',
      incidentType: 'elephant_sighting',
      createdAt: new Date().toISOString()
    };
    await recordOnlineSuccess(confirmation, payload());
    await recordOnlineSuccess(confirmation, payload());
    expect((await listReports()).filter((r) => r.reportId === 'CR-dup')).toHaveLength(1);
  });

  it('listReports returns newest first', async () => {
    await enqueue(payload());
    await new Promise((r) => setTimeout(r, 5));
    await enqueue(payload());
    const all = await listReports();
    expect(all.length).toBe(2);
    expect(all[0].createdAt >= all[1].createdAt).toBe(true);
  });

  it('flushQueue returns empty when nothing pending', async () => {
    await expect(flushQueue()).resolves.toEqual({ synced: [], remaining: [] });
  });

  it('flushQueue syncs pending reports to server', async () => {
    await enqueue(payload());
    api.syncReports.mockResolvedValueOnce({
      synced: 1,
      results: [{ clientRefId: expect.any(String), ok: true, reportId: 'CR-9' }]
    });
    // need the real ref id mapping: mock resolves by echoing queue ids
    api.syncReports.mockReset();
    const entry = (await loadQueue())[0];
    api.syncReports.mockResolvedValueOnce({
      synced: 1,
      results: [{ clientRefId: entry.clientRefId, ok: true, reportId: 'CR-9' }]
    });
    const res = await flushQueue();
    expect(res.synced).toHaveLength(1);
    expect(res.remaining).toHaveLength(0);
    const after = await loadQueue();
    expect(after[0].status).toBe('RECEIVED');
  });

  it('flushQueue keeps items remaining on network failure (retry)', async () => {
    await enqueue(payload());
    api.syncReports.mockRejectedValueOnce(new Error('offline'));
    const res = await flushQueue();
    expect(res.synced).toHaveLength(0);
    expect(res.remaining.length).toBeGreaterThan(0);
  });

  it('flushQueue records server rejections as lastError', async () => {
    await enqueue(payload());
    const entry = (await loadQueue())[0];
    api.syncReports.mockResolvedValueOnce({
      synced: 0,
      results: [{ clientRefId: entry.clientRefId, ok: false, message: 'Invalid location', errors: { location: 'bad' } }]
    });
    const res = await flushQueue();
    expect(res.synced).toHaveLength(0);
    expect(res.remaining).toHaveLength(1);
    expect(res.remaining[0].lastError).toMatch(/location/);
  });

  it('flushQueue uploads photos first, drops photo on permanent failure (E5)', async () => {
    await enqueue(payload(), 'file:///pic.jpg');
    api.uploadPhoto.mockRejectedValueOnce(new Error('permanent 415'));
    const entry = (await loadQueue())[0];
    api.syncReports.mockResolvedValueOnce({
      synced: 1,
      results: [{ clientRefId: entry.clientRefId, ok: true, reportId: 'CR-10' }]
    });
    const res = await flushQueue();
    expect(res.synced.length).toBe(1);
  });

  it('flushQueue stops batch on photo NetworkError', async () => {
    await enqueue(payload(), 'file:///a.jpg');
    await enqueue(payload());
    const { NetworkError } = require('../api/client');
    api.uploadPhoto.mockRejectedValueOnce(new NetworkError('base'));
    const res = await flushQueue();
    expect(res.remaining.length).toBeGreaterThan(0);
    expect(res.remaining[0].lastError).toMatch(/Photo upload interrupted/);
  });
});

