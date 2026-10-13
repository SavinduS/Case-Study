import React from 'react';
import { act, create } from 'react-test-renderer';
import OfflineBadge from '../components/OfflineBadge';

const NetInfo = require('@react-native-community/netinfo');

function texts(renderer: any): string {
  return renderer.root
    .findAll((n: any) => n.type === 'Text')
    .map((n: any) => {
      const c = n.props.children;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.filter((x) => typeof x === 'string').join('');
      return '';
    })
    .join(' | ');
}

function label(renderer: any): string | undefined {
  const node = renderer.root.findAll(
    (n: any) =>
      n.props?.accessibilityLabel === 'Online status: online' ||
      n.props?.accessibilityLabel === 'Offline status: offline'
  )[0];
  return node?.props?.accessibilityLabel;
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function renderBadge() {
  let renderer: any = null;
  act(() => {
    renderer = create(<OfflineBadge />);
  });
  return { renderer, unmount: () => act(() => renderer.unmount()) };
}

beforeEach(() => {
  NetInfo.__reset();
});

describe('OfflineBadge (live connectivity)', () => {
  it('shows Offline before the first check resolves (safe default)', () => {
    const { renderer, unmount } = renderBadge();
    expect(texts(renderer)).toMatch(/Offline/);
    expect(label(renderer)).toBe('Offline status: offline');
    unmount();
  });

  it('shows Offline when the device is offline', async () => {
    NetInfo.__setOnline(false);
    const { renderer, unmount } = renderBadge();
    await flush();
    expect(texts(renderer)).toMatch(/Offline/);
    expect(texts(renderer)).not.toMatch(/Online/);
    expect(label(renderer)).toBe('Offline status: offline');
    unmount();
  });

  it('shows Online when the device is online', async () => {
    NetInfo.__setOnline(true);
    const { renderer, unmount } = renderBadge();
    await flush();
    expect(texts(renderer)).toMatch(/Online/);
    expect(label(renderer)).toBe('Online status: online');
    unmount();
  });

  it('updates live on connectivity change', async () => {
    const { renderer, unmount } = renderBadge();
    await flush();
    expect(texts(renderer)).toMatch(/Offline/);
    NetInfo.__emit(false); // baseline
    NetInfo.__emit(true); // reconnect
    await flush();
    expect(texts(renderer)).toMatch(/Online/);
    NetInfo.__emit(false); // loss
    await flush();
    expect(texts(renderer)).toMatch(/Offline/);
    unmount();
  });

  it('states status in words with a matching accessibility label', async () => {
    NetInfo.__setOnline(true);
    const { renderer, unmount } = renderBadge();
    await flush();
    // Text and label agree — status is never color-alone.
    expect(texts(renderer)).toMatch(/Online/);
    expect(label(renderer)).toBe('Online status: online');
    unmount();
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderBadge();
    await flush();
    expect(NetInfo.__listenerCount()).toBe(1);
    unmount();
    expect(NetInfo.__listenerCount()).toBe(0);
  });

  it('ignores a late check resolving after unmount', async () => {
    const { unmount } = renderBadge();
    unmount();
    await flush();
    expect(NetInfo.__listenerCount()).toBe(0);
  });
});
