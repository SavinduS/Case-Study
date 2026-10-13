import React from 'react';
import { act, create } from 'react-test-renderer';
import { useRangerIncidents, viewForSubmitOutcome } from '../hooks/useRangerIncidents';
import {
  INCIDENT_STORAGE_KEY,
  listStoredIncidents,
  saveIncidentOffline
} from '../services/incidentStorage';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';

const { ApiError } = jest.requireActual('../api/client');
const { pingServer } = require('../api/client');
const { postFieldIncident } = require('../api/fieldIncidents');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const NetInfo = require('@react-native-community/netinfo');

jest.mock('../api/client', () => {
  const actual = jest.requireActual('../api/client');
  return { ...actual, pingServer: jest.fn() };
});
jest.mock('../api/fieldIncidents', () => ({ postFieldIncident: jest.fn() }));

const TOKEN = 'ranger-token';

function incident(overrides: Partial<ValidatedFieldIncident> = {}): ValidatedFieldIncident {
  return {
    capturedAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    incidentType: 'snare_illegal_hunting',
    description: 'Wire snare near trail',
    location: { coordinates: [36.821456, -1.292345], accuracyMeters: 8, manual: false },
    photoUri: null,
    ...overrides
  };
}

function renderHook() {
  let current: any = null;
  function Probe() {
    current = useRangerIncidents(TOKEN);
    return null;
  }
  let root: any = null;
  act(() => {
    root = create(<Probe />);
  });
  return { get: () => current, unmount: () => act(() => root.unmount()) };
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  AsyncStorage.__reset();
  NetInfo.__reset();
  jest.clearAllMocks();
  pingServer.mockResolvedValue({ reachable: false, base: 'http://test' });
});

describe('useRangerIncidents', () => {
  it('loads stored incidents on mount (app reload)', async () => {
    await saveIncidentOffline(incident({ description: 'first' }));
    await saveIncidentOffline(incident({ description: 'second' }));
    const h = renderHook();
    await flush();
    expect(h.get().loading).toBe(false);
    expect(h.get().incidents).toHaveLength(2);
    h.unmount();
  });

  it('offline submit saves pending and returns pending mode', async () => {
    pingServer.mockResolvedValue({ reachable: false, base: 'http://test' });
    const h = renderHook();
    await flush();
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident(), null);
    });
    expect(outcome.mode).toBe('pending');
    expect(outcome.stored.status).toBe('pending');
    expect(outcome.stored.reportId).toBe(outcome.stored.id);
    expect(h.get().incidents).toHaveLength(1);
    expect(postFieldIncident).not.toHaveBeenCalled();
    h.unmount();
  });

  it('online submit posts directly and persists displayId (Alt Flow 3)', async () => {
    pingServer.mockResolvedValue({ reachable: true, base: 'http://test' });
    postFieldIncident.mockResolvedValue({
      reportId: 'r1',
      displayId: 'FI-2026-0001',
      photo: { path: '/uploads/p.jpg', mimeType: 'image/jpeg', size: 10 }
    });
    const h = renderHook();
    await flush();
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident(), null);
    });
    expect(outcome.mode).toBe('synced');
    expect(outcome.stored.status).toBe('synced');
    expect(outcome.stored.displayId).toBe('FI-2026-0001');
    expect(outcome.stored.serverPhotoUrl).toBe('/uploads/p.jpg');
    expect(postFieldIncident).toHaveBeenCalledTimes(1);
    expect(postFieldIncident.mock.calls[0][0]).toBe(outcome.stored.reportId);
    h.unmount();
  });

  it('online network failure preserves the report as pending for retry', async () => {
    pingServer.mockResolvedValue({ reachable: true, base: 'http://test' });
    postFieldIncident.mockRejectedValue(
      Object.assign(new Error('Cannot reach the server'), { name: 'NetworkError' })
    );
    const h = renderHook();
    await flush();
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident(), null);
    });
    expect(outcome.mode).toBe('pending');
    expect(outcome.stored.status).toBe('pending');
    expect((await listStoredIncidents())).toHaveLength(1);
    h.unmount();
  });

  it('permanent validation rejection keeps the row failed with a useful error', async () => {
    pingServer.mockResolvedValue({ reachable: true, base: 'http://test' });
    postFieldIncident.mockRejectedValue(new ApiError(400, {
      message: 'Validation failed',
      errors: [{ field: 'description', message: 'Description is required' }]
    }));
    const h = renderHook();
    await flush();
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident(), null);
    });
    expect(outcome.error).toMatch(/Validation failed/);
    expect(outcome.stored.status).toBe('failed');
    expect(outcome.stored.lastError).toMatch(/Validation failed/);
    h.unmount();
  });

  it('editing a draft preserves the reportId (no duplicate row)', async () => {
    pingServer.mockResolvedValue({ reachable: false, base: 'http://test' });
    const h = renderHook();
    await flush();
    let first: any = null;
    await act(async () => {
      first = await h.get().submitReport(incident(), null);
    });
    let second: any = null;
    await act(async () => {
      second = await h.get().submitReport(incident({ description: 'corrected' }), first.stored.id);
    });
    expect(second.stored.id).toBe(first.stored.id);
    expect(second.stored.reportId).toBe(first.stored.reportId);
    expect(second.stored.incident.description).toBe('corrected');
    expect(await listStoredIncidents()).toHaveLength(1);
    h.unmount();
  });

  it('storage failure surfaces an error without losing stored rows', async () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      id: `id-${i}`,
      reportId: `id-${i}`,
      incident: incident(),
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0
    }));
    AsyncStorage.__setStore({ [INCIDENT_STORAGE_KEY]: JSON.stringify(many) });
    const h = renderHook();
    await flush();
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident({ description: 'unsavable draft' }), null);
    });
    expect(outcome.error).toMatch(/storage limit|storage is full/i);
    expect(h.get().submitError).toMatch(/storage limit|storage is full/i);
    expect(await listStoredIncidents()).toHaveLength(100);
    h.unmount();
  });

  it('syncNow posts pending rows with their reportIds and records failures', async () => {
    const h = renderHook();
    await flush();
    await act(async () => {
      await h.get().submitReport(incident({ description: 'a' }), null);
    });
    await act(async () => {
      await h.get().submitReport(incident({ description: 'b' }), null);
    });
    const pending = (await listStoredIncidents()).filter((i) => i.status === 'pending');
    expect(pending).toHaveLength(2);
    postFieldIncident
      .mockResolvedValueOnce({ reportId: pending[0].reportId, displayId: 'FI-2026-0001', photo: null })
      .mockRejectedValueOnce(new ApiError(400, { message: 'Validation failed', errors: [] }));
    let summary: any = null;
    await act(async () => {
      summary = await h.get().syncNow();
    });
    expect(summary.synced).toHaveLength(1);
    expect(summary.failed).toHaveLength(1);
    expect(postFieldIncident.mock.calls[0][0]).toBe(pending[0].reportId);
    const rows = await listStoredIncidents();
    expect(rows.find((r) => r.id === pending[0].id)?.status).toBe('synced');
    expect(rows.find((r) => r.id === pending[1].id)?.status).toBe('failed');
    h.unmount();
  });
});

describe('auto-sync on reconnect (Alt Flow 3)', () => {
  it('offline -> online triggers a sync of pending rows', async () => {
    await saveIncidentOffline(incident({ description: 'queued while offline' }));
    postFieldIncident.mockResolvedValue({
      reportId: 'auto-1',
      displayId: 'FI-2026-0001',
      photo: null
    });
    const h = renderHook();
    await flush();
    NetInfo.__emit(false); // baseline
    await flush();
    NetInfo.__emit(true); // reconnect
    await flush();
    await flush();
    expect(postFieldIncident).toHaveBeenCalledTimes(1);
    const rows = await listStoredIncidents();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('synced');
    expect(rows[0].displayId).toBe('FI-2026-0001');
    h.unmount();
  });

  it('online -> offline does not start a sync', async () => {
    await saveIncidentOffline(incident({ description: 'still queued' }));
    const h = renderHook();
    await flush();
    NetInfo.__emit(true); // baseline
    await flush();
    NetInfo.__emit(false); // loss of connectivity
    await flush();
    await flush();
    expect(postFieldIncident).not.toHaveBeenCalled();
    expect((await listStoredIncidents())[0].status).toBe('pending');
    h.unmount();
  });

  it('duplicate reconnect events never run concurrent syncs', async () => {
    await saveIncidentOffline(incident({ description: 'queued' }));
    let release: ((value: unknown) => void) | null = null;
    postFieldIncident.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const h = renderHook();
    await flush();
    NetInfo.__emit(false); // baseline
    await flush();
    NetInfo.__emit(true); // first reconnect starts the run
    await flush();
    NetInfo.__emit(false);
    await flush();
    NetInfo.__emit(true); // second reconnect while the first run is in flight
    await flush();
    expect(postFieldIncident).toHaveBeenCalledTimes(1);
    await act(async () => {
      release!({ reportId: 'auto-1', displayId: 'FI-2026-0001', photo: null });
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expect(postFieldIncident).toHaveBeenCalledTimes(1);
    expect((await listStoredIncidents())[0].status).toBe('synced');
    h.unmount();
  });

  it('manual Sync Now during an auto-sync run does not duplicate work', async () => {
    await saveIncidentOffline(incident({ description: 'queued' }));
    let release: ((value: unknown) => void) | null = null;
    postFieldIncident.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const h = renderHook();
    await flush();
    NetInfo.__emit(false);
    await flush();
    NetInfo.__emit(true); // auto-sync starts
    await flush();
    await act(async () => {
      await h.get().syncNow(); // manual tap while auto-sync is in flight
    });
    expect(postFieldIncident).toHaveBeenCalledTimes(1);
    await act(async () => {
      release!({ reportId: 'auto-1', displayId: 'FI-2026-0001', photo: null });
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expect(postFieldIncident).toHaveBeenCalledTimes(1);
    h.unmount();
  });

  it('unsubscribes the connectivity listener on unmount', async () => {
    const h = renderHook();
    await flush();
    expect(NetInfo.__listenerCount()).toBe(1);
    h.unmount();
    expect(NetInfo.__listenerCount()).toBe(0);
    postFieldIncident.mockResolvedValue({ reportId: 'x', displayId: 'FI-1', photo: null });
    NetInfo.__emit(false);
    NetInfo.__emit(true);
    await flush();
    expect(postFieldIncident).not.toHaveBeenCalled();
  });

  it('reconnect with zero pending is a no-op', async () => {
    postFieldIncident.mockResolvedValue({ reportId: 'x', displayId: 'FI-1', photo: null });
    const h = renderHook();
    await flush();
    NetInfo.__emit(false);
    await flush();
    NetInfo.__emit(true);
    await flush();
    await flush();
    expect(postFieldIncident).not.toHaveBeenCalled();
    expect(h.get().syncing).toBe(false);
    expect(h.get().syncError).toBeNull();
    h.unmount();
  });
});

describe('viewForSubmitOutcome (submit -> result routing)', () => {
  const failedRow: any = {
    id: 'r1',
    reportId: 'r1',
    incident: incident(),
    status: 'failed',
    lastError: 'Validation failed'
  };
  const pendingRow: any = { ...failedRow, status: 'pending', lastError: undefined };

  it('routes successes to the result screen', () => {
    expect(viewForSubmitOutcome({ stored: pendingRow, mode: 'pending' })).toBe('result');
    expect(viewForSubmitOutcome({ stored: { ...pendingRow, status: 'synced' }, mode: 'synced' })).toBe(
      'result'
    );
  });

  it('routes a stored rejection to the failed result state', () => {
    expect(viewForSubmitOutcome({ error: 'Validation failed', stored: failedRow })).toBe('result');
  });

  it('stays on review when there is no stored row to show', () => {
    expect(viewForSubmitOutcome({ error: 'You are signed out.', stored: null })).toBe('review');
    expect(viewForSubmitOutcome({ error: 'Storage is full.', stored: pendingRow })).toBe('review');
  });
});

describe('retryReport (same reportId, no duplicate)', () => {
  it('retries a failed row and syncs it without creating a duplicate', async () => {
    pingServer.mockResolvedValue({ reachable: true, base: 'http://test' });
    postFieldIncident
      .mockRejectedValueOnce(new ApiError(400, { message: 'Validation failed', errors: [] }))
      .mockResolvedValueOnce({ reportId: 'retry-1', displayId: 'FI-2026-0007', photo: null });
    const h = renderHook();
    await flush();
    let first: any = null;
    await act(async () => {
      first = await h.get().submitReport(incident({ description: 'retry me' }), null);
    });
    expect(first.stored.status).toBe('failed');
    const failedRow = first.stored;
    let second: any = null;
    await act(async () => {
      second = await h.get().retryReport(failedRow);
    });
    expect(second.mode).toBe('synced');
    expect(second.stored.id).toBe(failedRow.id);
    expect(second.stored.reportId).toBe(failedRow.reportId);
    expect(postFieldIncident).toHaveBeenCalledTimes(2);
    expect(postFieldIncident.mock.calls[0][0]).toBe(failedRow.reportId);
    expect(postFieldIncident.mock.calls[1][0]).toBe(failedRow.reportId);
    expect(await listStoredIncidents()).toHaveLength(1);
    h.unmount();
  });

  it('retry while offline keeps the row pending without posting', async () => {
    pingServer.mockResolvedValue({ reachable: false, base: 'http://test' });
    const h = renderHook();
    await flush();
    let first: any = null;
    await act(async () => {
      first = await h.get().submitReport(incident({ description: 'offline row' }), null);
    });
    expect(first.mode).toBe('pending');
    let second: any = null;
    await act(async () => {
      second = await h.get().retryReport(first.stored);
    });
    expect(second.mode).toBe('pending');
    expect(second.stored.id).toBe(first.stored.id);
    expect(postFieldIncident).not.toHaveBeenCalled();
    expect(await listStoredIncidents()).toHaveLength(1);
    h.unmount();
  });

  it('a repeated rejection stays failed and countable', async () => {
    pingServer.mockResolvedValue({ reachable: true, base: 'http://test' });
    postFieldIncident.mockRejectedValue(new ApiError(400, { message: 'Still bad', errors: [] }));
    const h = renderHook();
    await flush();
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident(), null);
    });
    const failedRow = outcome.stored;
    await act(async () => {
      outcome = await h.get().retryReport(failedRow);
    });
    expect(outcome.error).toMatch(/Still bad/);
    expect(outcome.stored.status).toBe('failed');
    expect(viewForSubmitOutcome(outcome)).toBe('result');
    expect(await listStoredIncidents()).toHaveLength(1);
    h.unmount();
  });
});
