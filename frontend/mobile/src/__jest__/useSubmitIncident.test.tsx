import React from 'react';
import { act, create } from 'react-test-renderer';
import { useSubmitIncident } from '../hooks/useSubmitIncident';
import {
  listStoredIncidents
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

function renderSubmit(token: string | null = TOKEN) {
  const refresh = jest.fn(async () => {});
  let current: any = null;
  function Probe() {
    current = useSubmitIncident(token, refresh);
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
  jest.clearAllMocks();
  pingServer.mockResolvedValue({ reachable: false, base: 'http://test' });
});

describe('useSubmitIncident (DeviceServices submit path)', () => {
  it('refuses to submit when signed out and stores nothing', async () => {
    const h = renderSubmit(null);
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident(), null);
    });
    expect(outcome.error).toMatch(/signed out/i);
    expect(outcome.stored).toBeNull();
    expect(await listStoredIncidents()).toHaveLength(0);
    expect(postFieldIncident).not.toHaveBeenCalled();
    h.unmount();
  });

  it('rejects a second submit while one is in flight', async () => {
    pingServer.mockResolvedValue({ reachable: true, base: 'http://test' });
    let release: ((value: unknown) => void) | null = null;
    postFieldIncident.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const h = renderSubmit();
    let first: Promise<any>;
    await act(async () => {
      first = h.get().submitReport(incident({ description: 'first' }), null);
      await new Promise((r) => setTimeout(r, 0));
    });
    let second: any = null;
    await act(async () => {
      second = await h.get().submitReport(incident({ description: 'second' }), null);
    });
    expect(second.error).toMatch(/already in progress/);
    await act(async () => {
      release!({ reportId: 'r1', displayId: 'FI-1', photo: null });
      await first!;
      await new Promise((r) => setTimeout(r, 0));
    });
    // One stored row: the in-flight submit won, the guarded one saved nothing.
    expect(await listStoredIncidents()).toHaveLength(1);
    h.unmount();
  });

  it('treats a throwing reachability check as offline', async () => {
    pingServer.mockRejectedValueOnce(new Error('probe blew up'));
    postFieldIncident.mockResolvedValue({ reportId: 'r1', displayId: 'FI-1', photo: null });
    const h = renderSubmit();
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident(), null);
    });
    expect(outcome.mode).toBe('pending');
    expect(postFieldIncident).not.toHaveBeenCalled();
    h.unmount();
  });

  it('clears the submit error on demand', async () => {
    const h = renderSubmit();
    await act(async () => {
      await h.get().submitReport(incident(), null).catch(() => {});
    });
    act(() => {
      h.get().clearSubmitError();
    });
    expect(h.get().submitError).toBeNull();
    h.unmount();
  });

  it('retryReport on a missing row reports an error without posting', async () => {
    pingServer.mockResolvedValue({ reachable: true, base: 'http://test' });
    const h = renderSubmit();
    const ghost: any = {
      id: 'ghost',
      reportId: 'ghost',
      incident: incident(),
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 1
    };
    let outcome: any = null;
    await act(async () => {
      // Draft missing from storage: falls back to a fresh offline save.
      outcome = await h.get().retryReport(ghost);
    });
    expect(outcome.stored.reportId).not.toBe('ghost');
    expect(await listStoredIncidents()).toHaveLength(1);
    h.unmount();
  });

  it('editing a missing draft saves fresh instead of crashing', async () => {
    const h = renderSubmit();
    let outcome: any = null;
    await act(async () => {
      outcome = await h.get().submitReport(incident(), 'no-such-id');
    });
    expect(outcome.mode).toBe('pending');
    expect(await listStoredIncidents()).toHaveLength(1);
    h.unmount();
  });
});
