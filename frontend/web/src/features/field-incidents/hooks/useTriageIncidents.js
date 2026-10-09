import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getResponders, getTriageIncidents, patchTriageIncident } from '../../../api/triage.js';

export const PAGE_LIMIT = 10;

const INITIAL_FILTERS = { status: '', severity: '', q: '' };

/** Server id may arrive as `id` or Mongo `_id`. */
export function triageId(incident) {
  return incident?.id ?? incident?._id ?? null;
}

/**
 * useTriageIncidents — view model for the supervisor triage queue.
 *
 * The server owns filtering and paging (GET /api/incidents/triage); this
 * hook only holds the current filter/page/selection and sends the four
 * triage actions back via PATCH. Mirrors the useCollarAlerts pattern:
 * a request id guards against slow responses overwriting newer ones.
 */
export default function useTriageIncidents({ limit = PAGE_LIMIT } = {}) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [incidents, setIncidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [responders, setResponders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const { incidents: rows, total: count } = await getTriageIncidents({
        status: filters.status || undefined,
        severity: filters.severity || undefined,
        q: filters.q || undefined,
        page,
        limit
      });
      if (requestId !== requestIdRef.current) return;
      setIncidents(rows);
      setTotal(count);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setError(caught?.message ?? 'Could not load incidents.');
      setIncidents([]);
      setTotal(0);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [filters, page, limit]);

  // Assignee list rarely changes — load once.
  useEffect(() => {
    let cancelled = false;
    getResponders()
      .then((rows) => {
        if (!cancelled) setResponders(rows);
      })
      .catch(() => {
        if (!cancelled) setResponders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit]
  );
  const safePage = Math.min(page, totalPages);

  const setFilter = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  }, []);

  const goToPage = useCallback(
    (next) => setPage(Math.min(Math.max(1, next), totalPages)),
    [totalPages]
  );
  const nextPage = useCallback(() => goToPage(page + 1), [goToPage, page]);
  const prevPage = useCallback(() => goToPage(page - 1), [goToPage, page]);

  const selected = useMemo(
    () => incidents.find((item) => triageId(item) === selectedId) ?? null,
    [incidents, selectedId]
  );
  const select = useCallback((id) => {
    setSelectedId(id);
    setActionError(null);
    setActionNotice(null);
  }, []);
  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setActionError(null);
    setActionNotice(null);
  }, []);

  /**
   * Sends one triage action for the selected incident. Buttons stay
   * disabled while the request runs (actionBusy). A 409 means another
   * supervisor got there first: show "Status changed by someone else"
   * and refresh the incident instead of failing silently.
   */
  const runAction = useCallback(
    async (action, { assigneeId, reason } = {}) => {
      const id = selectedId;
      if (!id || actionBusy) return null;
      setActionBusy(true);
      setActionError(null);
      setActionNotice(null);
      try {
        const updated = await patchTriageIncident(id, { action, assigneeId, reason });
        await load();
        return updated;
      } catch (caught) {
        if (caught?.status === 409) {
          setActionNotice('Status changed by someone else. Showing the latest version.');
          await load();
        } else {
          setActionError(caught?.message ?? 'Action failed. Please try again.');
        }
        return null;
      } finally {
        setActionBusy(false);
      }
    },
    [selectedId, actionBusy, load]
  );

  return {
    incidents,
    total,
    page: safePage,
    totalPages,
    limit,
    filters,
    setFilter,
    resetFilters,
    nextPage,
    prevPage,
    loading,
    error,
    refresh: load,
    responders,
    selected,
    selectedId,
    select,
    closeDetail,
    runAction,
    actionBusy,
    actionError,
    actionNotice
  };
}
