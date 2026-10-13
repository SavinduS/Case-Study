import { useCallback, useEffect, useState } from 'react';
import { listStoredIncidents, type StoredFieldIncident } from '../services/incidentStorage';

/** Loads and refreshes the on-device incident list (IncidentDB reads). */
export function useIncidentList() {
  const [incidents, setIncidents] = useState<StoredFieldIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIncidents(await listStoredIncidents());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const items = await listStoredIncidents();
        if (!cancelled) setIncidents(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { incidents, loading, refresh };
}
