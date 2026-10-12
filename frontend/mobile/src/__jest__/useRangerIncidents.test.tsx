import React from 'react';
import { act, create } from 'react-test-renderer';
import { useRangerIncidents } from '../hooks/useRangerIncidents';
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
