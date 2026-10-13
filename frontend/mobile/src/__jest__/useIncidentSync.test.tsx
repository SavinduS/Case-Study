import React from 'react';
import { act, create } from 'react-test-renderer';
import { useIncidentSync } from '../hooks/useIncidentSync';
import {
  listStoredIncidents,
  saveIncidentOffline
} from '../services/incidentStorage';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';

const { ApiError } = jest.requireActual('../api/client');
const { postFieldIncident } = require('../api/fieldIncidents');
const { syncPendingIncidents } = require('../services/syncService');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const NetInfo = require('@react-native-community/netinfo');

jest.mock('../api/fieldIncidents', () => ({ postFieldIncident: jest.fn() }));
jest.mock('../services/syncService', () => {
  const actual = jest.requireActual('../services/syncService');
  return { ...actual, syncPendingIncidents: jest.fn((deps: any) => actual.syncPendingIncidents(deps)) };
});

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

function renderSync(token: string | null = TOKEN) {
  const refresh = jest.fn(async () => {});
  let current: any = null;
  function Probe() {
    current = useIncidentSync(token, refresh);
    return null;
  }
  let root: any = null;
  act(() => {
    root = create(<Probe />);
  });
  return { get: () => current, refresh, unmount: () => act(() => root.unmount()) };
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
});

describe('useIncidentSync (SyncService sync path)', () => {
  it('does nothing without a token', async () => {
    await saveIncidentOffline(incident());
    const h = renderSync(null);
    let summary: any = null;
    await act(async () => {
      summary = await h.get().syncNow();
    });
    expect(summary).toEqual({ synced: [], failed: [], remaining: [] });
    expect(postFieldIncident).not.toHaveBeenCalled();
    expect(h.get().syncing).toBe(false);
    h.unmount();
  });

  it('syncs pending rows and clears the banner on full success', async () => {
    await saveIncidentOffline(incident({ description: 'a' }));
    postFieldIncident.mockResolvedValue({ reportId: 'r1', displayId: 'FI-1', photo: null });
    const h = renderSync();
    let summary: any = null;
    await act(async () => {
      summary = await h.get().syncNow();
    });
    expect(summary.synced).toHaveLength(1);
    expect(h.get().syncError).toBeNull();
    expect(h.refresh).toHaveBeenCalled();
    h.unmount();
  });

  it('surfaces the rejection banner when rows fail validation', async () => {
    await saveIncidentOffline(incident());
    postFieldIncident.mockRejectedValue(new ApiError(400, { message: 'Nope', errors: [] }));
    const h = renderSync();
    await act(async () => {
      await h.get().syncNow();
    });
    expect(h.get().syncError).toMatch(/rejected/i);
    h.unmount();
  });

  it('surfaces the interrupted banner when rows remain after retries', async () => {
    await saveIncidentOffline(incident());
    postFieldIncident.mockRejectedValue(
      Object.assign(new Error('Cannot reach the server'), { name: 'NetworkError' })
    );
    const h = renderSync();
    await act(async () => {
      await h.get().syncNow();
    });
    expect(h.get().syncError).toMatch(/interrupted/i);
    expect((await listStoredIncidents())[0].status).toBe('failed');
    h.unmount();
  });

  it('second syncNow while syncing returns empty without posting again', async () => {
    await saveIncidentOffline(incident());
    let release: ((value: unknown) => void) | null = null;
    postFieldIncident.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const h = renderSync();
    let first: Promise<any>;
    await act(async () => {
      first = h.get().syncNow();
      await new Promise((r) => setTimeout(r, 0));
    });
    let second: any = null;
    await act(async () => {
      second = await h.get().syncNow();
    });
    expect(second).toEqual({ synced: [], failed: [], remaining: [] });
    await act(async () => {
      release!({ reportId: 'r1', displayId: 'FI-1', photo: null });
      await first!;
    });
    expect(postFieldIncident).toHaveBeenCalledTimes(1);
    h.unmount();
  });

  it('a sync worker crash surfaces the generic banner', async () => {
    syncPendingIncidents.mockRejectedValueOnce(new Error('worker blew up'));
    const h = renderSync();
    let summary: any = null;
    await act(async () => {
      summary = await h.get().syncNow();
    });
    expect(summary).toEqual({ synced: [], failed: [], remaining: [] });
    expect(h.get().syncError).toMatch(/Sync failed/);
    expect(h.get().syncing).toBe(false);
    h.unmount();
  });

  it('auto-syncs on reconnect and unsubscribes on unmount', async () => {
    await saveIncidentOffline(incident());
    postFieldIncident.mockResolvedValue({ reportId: 'r1', displayId: 'FI-1', photo: null });
    const h = renderSync();
    NetInfo.__emit(false);
    await flush();
    NetInfo.__emit(true);
    await flush();
    await flush();
    expect(postFieldIncident).toHaveBeenCalledTimes(1);
    h.unmount();
    expect(NetInfo.__listenerCount()).toBe(0);
  });

  it('clears the sync error on demand', async () => {
    const h = renderSync();
    await act(async () => {
      await h.get().syncNow();
    });
    act(() => {
      h.get().clearSyncError();
    });
    expect(h.get().syncError).toBeNull();
    h.unmount();
  });
});
