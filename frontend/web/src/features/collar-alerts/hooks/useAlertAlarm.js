import { useCallback, useEffect, useRef, useState } from 'react';
import { audioSupported, createAlarm } from '../services/alertAlarm.js';

const MUTE_KEY = '@wildlife-alert/alarm-muted';

/**
 * useAlertAlarm - the audible half of the critical alert notification.
 *
 * The alarm is driven by alert *events*, not by rendering or by the poll
 * interval: the caller passes the alerts the hook in useCollarAlerts has just
 * finished announcing. Each alert reference is sounded once, so the 3-second
 * refresh that returns the same open breach does not restart the siren.
 *
 * Browsers only allow audio after the user has interacted with the page. Rather
 * than silently staying quiet, `blocked` is reported so the UI can offer an
 * "Enable sound" control, and the officer's mute choice is remembered.
 */
export default function useAlertAlarm({ announcedAlerts = [], enabled = true } = {}) {
  const [muted, setMutedState] = useState(() => readStoredMute());
  const [blocked, setBlocked] = useState(false);
  const [supported] = useState(() => audioSupported());

  const alarmRef = useRef(null);
  const soundedRef = useRef(new Set());
  // The last announced set is held in a ref so the effect below only reruns
  // when the announcement itself changes, not on every unrelated render.
  const announcedKey = (announcedAlerts ?? []).map((alert) => alert.alertId).join('|');

  useEffect(() => {
    if (!supported) return undefined;
    const alarm = createAlarm();
    alarmRef.current = alarm;
    alarm.setMuted(readStoredMute());
    return () => {
      // Never let the siren keep running after the page is left.
      alarm.stop();
      alarmRef.current = null;
    };
  }, [supported]);

  // Sound each newly announced alert exactly once.
  useEffect(() => {
    if (!enabled || !supported) return;
    const fresh = (announcedAlerts ?? []).filter((alert) => !soundedRef.current.has(alert.alertId));
    if (fresh.length === 0) return;

    let cancelled = false;
    (async () => {
      const result = await alarmRef.current?.play();
      if (cancelled) return;
      setBlocked(result === 'blocked');
      // Marked as sounded either way: a blocked attempt must not be retried on
      // every poll, it waits for the officer to enable sound.
      fresh.forEach((alert) => soundedRef.current.add(alert.alertId));
    })();

    return () => {
      cancelled = true;
    };
    // `announcedKey` is the stable identity of "a new alert was announced".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcedKey, enabled, supported]);

  const setMuted = useCallback((next) => {
    const value = Boolean(next);
    setMutedState(value);
    alarmRef.current?.setMuted(value);
    storeMute(value);
    return value;
  }, []);

  const toggleMuted = useCallback(() => setMuted(!muted), [muted, setMuted]);

  /** Called after a user gesture, once the browser will allow audio. */
  const enableSound = useCallback(async () => {
    const alarm = alarmRef.current;
    if (!alarm) return 'unsupported';
    const result = await alarm.play();
    setBlocked(result === 'blocked');
    return result;
  }, []);

  return { muted, toggleMuted, setMuted, blocked, supported, enableSound };
}

function readStoredMute() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeMute(value) {
  try {
    window.localStorage.setItem(MUTE_KEY, String(value));
  } catch {
    // Storage unavailable; the choice lasts for this page only.
  }
}