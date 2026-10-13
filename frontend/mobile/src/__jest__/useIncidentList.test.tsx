import React from 'react';
import { act, create } from 'react-test-renderer';
import { useIncidentList } from '../hooks/useIncidentList';
import { saveIncidentOffline } from '../services/incidentStorage';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';

const AsyncStorage = require('@react-native-async-storage/async-storage');

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

function renderList() {
  let current: any = null;
  function Probe() {
    current = useIncidentList();
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
});

describe('useIncidentList (IncidentDB reads)', () => {
  it('starts loading then delivers stored rows newest-first', async () => {
    await saveIncidentOffline(incident({ description: 'first' }));
    const h = renderList();
    await flush();
    expect(h.get().loading).toBe(false);
    expect(h.get().incidents).toHaveLength(1);
    expect(h.get().incidents[0].incident.description).toBe('first');
    h.unmount();
  });

  it('starts empty when nothing is stored', async () => {
    const h = renderList();
    await flush();
    expect(h.get().loading).toBe(false);
    expect(h.get().incidents).toEqual([]);
    h.unmount();
  });

  it('refresh reloads rows saved outside the hook', async () => {
    const h = renderList();
    await flush();
    expect(h.get().incidents).toHaveLength(0);
    await saveIncidentOffline(incident({ description: 'added later' }));
    await act(async () => {
      await h.get().refresh();
    });
    expect(h.get().incidents).toHaveLength(1);
    expect(h.get().incidents[0].incident.description).toBe('added later');
    h.unmount();
  });

  it('ignores a late load resolving after unmount (no state update)', async () => {
    await saveIncidentOffline(incident({ description: 'first' }));
    const h = renderList();
    h.unmount();
    await flush();
    // Last render before unmount never received the rows.
    expect(h.get().loading).toBe(true);
    expect(h.get().incidents).toEqual([]);
  });
});
