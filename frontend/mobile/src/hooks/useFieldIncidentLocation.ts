import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCurrentFix,
  requestLocationPermission,
  type GpsFix,
  type GpsState
} from '../services/location';
import { LOCATION_TIMEOUT_MS } from '../constants/fieldIncident';
import type { FieldIncidentLocation } from '../fieldIncidentTypes';

export type FieldLocationErrorKind = 'permission-denied' | 'timeout' | 'unavailable';

export interface UseFieldIncidentLocationOptions {
  /** Fix handed back from the shared map picker (manual Alt-flow 1). */
  externalFix?: GpsFix | null;
}

export interface UseFieldIncidentLocationResult {
  /** Shared shape, so the shared LocationCard can render it directly. */
  gps: GpsState;
  location: FieldIncidentLocation | null;
  errorKind: FieldLocationErrorKind | null;
  retry: () => void;
}

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location-timeout')), ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * GPS capture for the field-incident form. Wraps the shared location service
 * (expo-location permission + fix) and maps every failure to a kind the UI
 * can explain: permission denied, GPS timeout, or position unavailable.
 * A pin chosen on the shared map picker arrives via `externalFix`.
 */
export function useFieldIncidentLocation(
  options?: UseFieldIncidentLocationOptions
): UseFieldIncidentLocationResult {
  const externalFix = options?.externalFix ?? null;
  const [gps, setGps] = useState<GpsState>({
    status: 'detecting',
    fix: null,
    manual: false
  });
  const [errorKind, setErrorKind] = useState<FieldLocationErrorKind | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const detect = useCallback(async () => {
    setErrorKind(null);
    setGps({ status: 'detecting', fix: null, manual: false });
    const granted = await requestLocationPermission();
    if (!mounted.current) return;
    if (!granted) {
      setErrorKind('permission-denied');
      setGps({
        status: 'error',
        fix: null,
        manual: false,
        error: 'Location permission was denied. You can still set the location on the map.'
      });
      return;
    }
    try {
      const fix = await withTimeout(getCurrentFix(), LOCATION_TIMEOUT_MS);
      if (!mounted.current) return;
      setGps({ status: 'located', fix, manual: false });
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof Error && err.message === 'location-timeout') {
        setErrorKind('timeout');
        setGps({
          status: 'error',
          fix: null,
          manual: false,
          error: 'GPS timed out. Retry, or set the location on the map.'
        });
      } else {
        setErrorKind('unavailable');
        setGps({
          status: 'error',
          fix: null,
          manual: false,
          error: 'GPS could not determine your position. Retry, or set the location on the map.'
        });
      }
    }
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  // Adopt a pin dropped on the shared map picker (Alt flow 1).
  useEffect(() => {
    if (externalFix) {
      setErrorKind(null);
      setGps({ status: 'located', fix: externalFix, manual: true });
    }
  }, [externalFix]);

  const retry = useCallback(() => {
    void detect();
  }, [detect]);

  const location: FieldIncidentLocation | null =
    gps.status === 'located' && gps.fix
      ? { ...gps.fix, manual: gps.manual }
      : null;

  return { gps, location, errorKind, retry };
}