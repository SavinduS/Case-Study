import { ConnectivityService, readOnlineState } from '../services/connectivity';

const NetInfo = require('@react-native-community/netinfo');

beforeEach(() => {
  NetInfo.__reset();
});

describe('readOnlineState', () => {
  it.each([
    ['disconnected', false, true, false],
    ['disconnected, reachability unknown', false, null, false],
    ['connected and reachable', true, true, true],
    ['connected but not reachable', true, false, false],
    ['connected, reachability unknown falls back to connected', true, null, true],
    ['null connection flag', null, true, false]
  ])('%s', (_label: string, isConnected: boolean | null, isInternetReachable: boolean | null, expected: boolean) => {
    expect(readOnlineState({ isConnected, isInternetReachable })).toBe(expected);
  });
});

describe('ConnectivityService.isOnline', () => {
  it('resolves true when the device is online', async () => {
    NetInfo.__setOnline(true);
    await expect(ConnectivityService.isOnline()).resolves.toBe(true);
  });

  it('resolves false when the device is offline', async () => {
    NetInfo.__setOnline(false);
    await expect(ConnectivityService.isOnline()).resolves.toBe(false);
  });

  it('resolves false when the platform check throws', async () => {
    const spy = jest.spyOn(NetInfo, 'fetch').mockRejectedValueOnce(new Error('no NetInfo'));
    try {
      await expect(ConnectivityService.isOnline()).resolves.toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('ConnectivityService.subscribe', () => {
  it('fires on offline -> online and ignores duplicates', () => {
    const seen: boolean[] = [];
    const unsubscribe = ConnectivityService.subscribe((online) => seen.push(online));
    NetInfo.__emit(false); // baseline, silent
    NetInfo.__emit(false); // duplicate, silent
    NetInfo.__emit(true); // reconnect
    NetInfo.__emit(true); // duplicate, silent
    expect(seen).toEqual([true]);
    unsubscribe();
  });

  it('fires on online -> offline so badges can go live', () => {
    const seen: boolean[] = [];
    const unsubscribe = ConnectivityService.subscribe((online) => seen.push(online));
    NetInfo.__emit(true); // baseline, silent
    NetInfo.__emit(false);
    expect(seen).toEqual([false]);
    unsubscribe();
  });

  it('treats the first observed state as baseline, not a transition', () => {
    const seen: boolean[] = [];
    const unsubscribe = ConnectivityService.subscribe((online) => seen.push(online));
    NetInfo.__emit(true); // mount while online: no sync storm
    expect(seen).toEqual([]);
    unsubscribe();
  });

  it('unsubscribes the platform listener on cleanup', () => {
    const cb = jest.fn();
    const unsubscribe = ConnectivityService.subscribe(cb);
    expect(NetInfo.__listenerCount()).toBe(1);
    unsubscribe();
    expect(NetInfo.__listenerCount()).toBe(0);
    NetInfo.__emit(false);
    NetInfo.__emit(true);
    expect(cb).not.toHaveBeenCalled();
  });
});
