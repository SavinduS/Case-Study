import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createAlarm, audioSupported } from '../src/features/collar-alerts/services/alertAlarm.js';
import useAlertAlarm from '../src/features/collar-alerts/hooks/useAlertAlarm.js';
import { ALERT_STATUS } from '../src/features/collar-alerts/domain/labels.js';

/**
 * The alarm is the audible half of the critical alert notification, so these
 * tests are about two things the browser will not tell you by inspection:
 * that a rejected autoplay policy is reported rather than swallowed, and that
 * the siren never keeps running after the page is left.
 */

/** A stand-in for the Web Audio graph, recording what was asked of it. */
function fakeContext() {
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    oscillators: [],
    resumed: 0,
    closed: 0,
    createOscillator() {
      const oscillator = {
        type: null,
        frequency: { value: 0 },
        gain: null,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        ended: false
      };
      ctx.oscillators.push(oscillator);
      return oscillator;
    },
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn()
      };
    },
    resume() {
      ctx.resumed += 1;
      ctx.state = 'running';
      return Promise.resolve();
    },
    close() {
      ctx.closed += 1;
      return Promise.resolve();
    }
  };
  return ctx;
}

const ALERT = { alertId: 'CBA-1', status: ALERT_STATUS.ACTIVE, threatLevel: 'critical' };

let contexts;
let originalCtor;

beforeEach(() => {
  contexts = [];
  originalCtor = window.AudioContext;
  window.AudioContext = function AudioContextStub() {
    const ctx = fakeContext();
    contexts.push(ctx);
    return ctx;
  };
  window.localStorage.clear();
});

afterEach(() => {
  window.AudioContext = originalCtor;
  vi.restoreAllMocks();
});

describe('createAlarm', () => {
  it('synthesises a short two-tone pattern rather than needing an audio file', async () => {
    const alarm = createAlarm();
    await expect(alarm.play()).resolves.toBe('played');

    expect(contexts).toHaveLength(1);
    expect(contexts[0].oscillators.length).toBeGreaterThan(1);
    // Two alternating frequencies, so it reads as an alarm rather than a beep.
    const frequencies = contexts[0].oscillators.map((o) => o.frequency.value);
    expect(new Set(frequencies).size).toBe(2);
    alarm.stop();
  });

  it('stays quiet and says so when the officer muted it', async () => {
    const alarm = createAlarm();
    alarm.setMuted(true);
    await expect(alarm.play()).resolves.toBe('muted');
    expect(contexts).toHaveLength(0);
  });

  it('reports "blocked" instead of throwing when the browser refuses audio', async () => {
    const alarm = createAlarm({ createContext: () => ({ state: 'suspended', resume: () => Promise.resolve() }) });
    await expect(alarm.play()).resolves.toBe('blocked');
  });

  it('does not start a second pattern while one is playing', async () => {
    const alarm = createAlarm();
    await alarm.play();
    await expect(alarm.play()).resolves.toBe('playing');
    expect(contexts).toHaveLength(1);
    alarm.stop();
  });

  it('closes the audio context on stop, so nothing keeps sounding', async () => {
    const alarm = createAlarm();
    await alarm.play();
    await alarm.stop();
    expect(contexts[0].closed).toBe(1);
    expect(alarm.isPlaying()).toBe(false);
  });

  it('can play again after being stopped', async () => {
    const alarm = createAlarm();
    await alarm.play();
    await alarm.stop();
    await expect(alarm.play()).resolves.toBe('played');
    expect(contexts).toHaveLength(2);
    await alarm.stop();
  });

  it('reports no support when the browser has no Web Audio at all', () => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
    expect(audioSupported()).toBe(false);
  });
});

describe('useAlertAlarm', () => {
  it('sounds once for a newly announced alert, not once per poll', async () => {
    const { result, rerender } = renderHook(
      ({ announced }) => useAlertAlarm({ announcedAlerts: announced }),
      { initialProps: { announced: [ALERT] } }
    );

    await waitFor(() => expect(result.current.blocked).toBe(false));
    expect(contexts).toHaveLength(1);

    // The 3-second poll returns the same open breach: nothing new to announce,
    // and no second siren.
    rerender({ announced: [ALERT] });
    await act(async () => { await Promise.resolve(); });
    expect(contexts).toHaveLength(1);
  });

  it('does not stack sirens when two breaches are announced at once', async () => {
    const { rerender } = renderHook(
      ({ announced }) => useAlertAlarm({ announcedAlerts: announced }),
      { initialProps: { announced: [ALERT] } }
    );
    await waitFor(() => expect(contexts).toHaveLength(1));

    rerender({ announced: [ALERT, { ...ALERT, alertId: 'CBA-2' }] });
    await act(async () => { await Promise.resolve(); });

    // The siren is already sounding; a second pattern on top would be noise.
    expect(contexts).toHaveLength(1);
    expect(contexts[0].oscillators.length).toBeGreaterThan(1);
  });

  it('closes the audio context when the page unmounts, so nothing keeps sounding', async () => {
    const { unmount } = renderHook(() => useAlertAlarm({ announcedAlerts: [ALERT] }));
    await waitFor(() => expect(contexts).toHaveLength(1));

    unmount();
    await waitFor(() => expect(contexts[0].closed).toBe(1));
  });

  it('remembers the mute choice across a remount', async () => {
    const first = renderHook(() => useAlertAlarm({ announcedAlerts: [ALERT] }));
    await waitFor(() => expect(first.result.current.muted).toBe(false));
    act(() => { first.result.current.toggleMuted(); });
    await waitFor(() => expect(first.result.current.muted).toBe(true));
    first.unmount();

    const before = contexts.length;
    const second = renderHook(() => useAlertAlarm({ announcedAlerts: [ALERT] }));
    expect(second.result.current.muted).toBe(true);
    await act(async () => { await second.result.current.enableSound(); });
    expect(contexts).toHaveLength(before);
  });

  it('offers an explicit way out of a blocked autoplay policy', async () => {
    // Browsers keep a context suspended until the user interacts with the page.
    window.AudioContext = function BlockedContext() {
      const ctx = fakeContext();
      ctx.state = 'suspended';
      let attempts = 0;
      ctx.resume = () => {
        attempts += 1;
        if (attempts === 1) return Promise.resolve(); // still suspended
        ctx.state = 'running';
        return Promise.resolve();
      };
      contexts.push(ctx);
      return ctx;
    };

    const { result } = renderHook(() => useAlertAlarm({ announcedAlerts: [ALERT] }));
    await waitFor(() => expect(result.current.blocked).toBe(true));

    // The officer clicks "Enable alert sound" — that is the user gesture.
    await act(async () => { await result.current.enableSound(); });
    expect(result.current.blocked).toBe(false);
    expect(contexts[0].oscillators.length).toBeGreaterThan(0);
  });

  it('never sounds while the officer has sound turned off', async () => {
    window.localStorage.setItem('@wildlife-alert/alarm-muted', 'true');

    const { result } = renderHook(() => useAlertAlarm({ announcedAlerts: [ALERT] }));
    await act(async () => { await result.current.enableSound(); });

    expect(result.current.muted).toBe(true);
    expect(contexts).toHaveLength(0);
  });
});