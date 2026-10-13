import React from 'react';
import { act, create } from 'react-test-renderer';
import { useFieldIncidentLocation } from '../hooks/useFieldIncidentLocation';

const LocationMock = require('expo-location');

function renderLocation(externalFix: any = null) {
  let current: any = null;
  function Probe(props: { fix: any }) {
    current = useFieldIncidentLocation({ externalFix: props.fix });
    return null;
  }
  let root: any = null;
  act(() => {
    root = create(<Probe fix={externalFix} />);
  });
  return {
    get: () => current,
    rerender: (fix: any) => {
      act(() => {
        root.update(<Probe fix={fix} />);
      });
    },
    unmount: () => act(() => root.unmount())
  };
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('useFieldIncidentLocation', () => {
  beforeEach(() => {
    LocationMock.__reset();
    jest.useRealTimers();
  });

  it('starts in detecting state', async () => {
    LocationMock.__setPermission('granted');
    // Delay the fix so we can observe the initial detecting state synchronously,
    // then let it resolve so no 12s withTimeout timer leaks.
    LocationMock.getCurrentPositionAsync.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ coords: { longitude: 1, latitude: 2 } }), 20))
    );
    const h = renderLocation();
    expect(h.get().gps.status).toBe('detecting');
    expect(h.get().location).toBeNull();
    expect(h.get().errorKind).toBeNull();
    await flush();
    await flush();
    h.unmount();
    LocationMock.__reset();
  });

  it('GPS detection success yields located + location', async () => {
    LocationMock.__setPermission('granted');
    LocationMock.__setFix({
      coords: { longitude: 10, latitude: 20, accuracy: 5 }
    });
    const h = renderLocation();
    await flush();
    await flush();
    await flush();
    expect(h.get().gps.status).toBe('located');
    expect(h.get().errorKind).toBeNull();
    expect(h.get().location).toMatchObject({
      coordinates: [10, 20],
      manual: false
    });
    h.unmount();
  });

  it('permission denied maps to permission-denied + error gps', async () => {
    LocationMock.__setPermission('denied');
    const h = renderLocation();
    await flush();
    expect(h.get().errorKind).toBe('permission-denied');
    expect(h.get().gps.status).toBe('error');
    expect(h.get().gps.error).toMatch(/permission was denied/i);
    expect(h.get().location).toBeNull();
    h.unmount();
  });

  it('GPS failure maps to unavailable', async () => {
    LocationMock.__setPermission('granted');
    LocationMock.__setFixError(new Error('satellites gone'));
    const h = renderLocation();
    await flush();
    await flush();
    expect(h.get().errorKind).toBe('unavailable');
    expect(h.get().gps.status).toBe('error');
    expect(h.get().location).toBeNull();
    h.unmount();
  });

  it('retry() re-attempts detection after failure', async () => {
    LocationMock.__setPermission('denied');
    const h = renderLocation();
    await flush();
    expect(h.get().errorKind).toBe('permission-denied');
    LocationMock.__setPermission('granted');
    LocationMock.__setFix({ coords: { longitude: 1, latitude: 2, accuracy: 3 } });
    await act(async () => {
      h.get().retry();
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expect(h.get().gps.status).toBe('located');
    expect(h.get().location?.coordinates).toEqual([1, 2]);
    h.unmount();
  });

  it('adopts externalFix (manual pin) and marks manual', async () => {
    LocationMock.__setPermission('granted');
    LocationMock.__setFix({ coords: { longitude: 36.82, latitude: -1.29, accuracy: 8 } });
    const h = renderLocation();
    await flush();
    const pin = { coordinates: [81.4, 6.5] as [number, number] };
    h.rerender(pin);
    expect(h.get().gps.status).toBe('located');
    expect(h.get().gps.manual).toBe(true);
    expect(h.get().location).toMatchObject({ manual: true });
    expect(h.get().errorKind).toBeNull();
    h.unmount();
    LocationMock.__reset();
  });

  it('timeout maps to timeout kind', async () => {
    jest.useFakeTimers();
    LocationMock.__setPermission('granted');
    LocationMock.getCurrentPositionAsync.mockImplementation(() => new Promise(() => {}));
    const h = renderLocation();
    // let permission resolve and withTimeout timer get scheduled
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    // advance past LOCATION_TIMEOUT_MS (12s)
    await act(async () => {
      jest.advanceTimersByTime(13000);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.get().errorKind).toBe('timeout');
    expect(h.get().gps.status).toBe('error');
    h.unmount();
    jest.useRealTimers();
    LocationMock.__reset();
  });
});

