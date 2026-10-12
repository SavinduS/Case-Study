import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../../services/api.js';
import { SUBMISSION_METHOD, isOpenConflict } from '../domain/labels.js';

const POLL_INTERVAL_MS = 15000;

/**
 * useVillagerReports — the conflict reports villagers file from the field app
 * and the SMS hotline, grouped for the officer who triages them.
 *
 * Read-only on purpose. The backend defines UNDER_REVIEW / ACTION_REQUIRED /
 * RESOLVED but exposes no route that advances a report's status, so this hook
 * never decides that a report was handled; it fetches what the database holds
 * and derives the counts the officer actually filters on.
 *
 * The 200-report ceiling is the server's own cap on GET /conflict-reports, not
 * a limit chosen here, so every figure below describes the same window.
 */
export default function useVillagerReports({ pollIntervalMs = POLL_INTERVAL_MS } = {}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  // Channel and category are separate controls: the officer usually asks "what
  // came in by SMS today", but sometimes "all the crop damage, either channel".
  const [method, setMethod] = useState('');
  const [incidentType, setIncidentType] = useState('');
  const [query, setQuery] = useState('');

  // Guards a slow response from a previous poll overwriting a newer one.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const payload = await api.getConflictReports({ limit: 200 });
      if (requestId !== requestIdRef.current) return;

      setReports(payload?.reports ?? []);
      setError(null);
      setLastUpdatedAt(new Date());
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setError(caught.message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, pollIntervalMs);
    return () => clearInterval(timer);
  }, [load, pollIntervalMs]);

  /** Counts per channel, computed over the unfiltered set so the tabs stay stable. */
  const byMethod = useMemo(() => {
    const counts = { '': reports.length };
    for (const report of reports) {
      const key = report.submissionMethod === SUBMISSION_METHOD.SMS
        ? SUBMISSION_METHOD.SMS
        : SUBMISSION_METHOD.APP;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [reports]);

  /** Counts per category, likewise unfiltered. */
  const byType = useMemo(() => {
    const counts = {};
    for (const report of reports) {
      counts[report.incidentType] = (counts[report.incidentType] ?? 0) + 1;
    }
    return counts;
  }, [reports]);

  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (method && report.submissionMethod !== method) return false;
      if (incidentType && report.incidentType !== incidentType) return false;
      if (!needle) return true;
      // The free-text search covers what the officer would read off a printed
      // slip: the reference, the place name and the villager's own words.
      return [report.reportId, report.locationText, report.description, report.reporterContact]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [reports, method, incidentType, query]);

  const stats = useMemo(() => {
    const open = reports.filter(isOpenConflict);
    return {
      total: reports.length,
      open: open.length,
      resolved: reports.length - open.length,
      sms: byMethod[SUBMISSION_METHOD.SMS] ?? 0,
      app: byMethod[SUBMISSION_METHOD.APP] ?? 0,
      duplicates: reports.filter((report) => report.isPossibleDuplicate).length,
      outsideArea: reports.filter((report) => report.outsideSupportedArea).length,
      // A report with nothing to act on beyond a type is the SMS reality: no
      // photo, no GPS accuracy, often no description.
      withoutPhoto: open.filter((report) => !report.photoUrl).length
    };
  }, [reports, byMethod]);

  return {
    loading,
    error,
    lastUpdatedAt,
    reports,
    visibleReports,
    stats,
    byMethod,
    byType,
    method,
    setMethod,
    incidentType,
    setIncidentType,
    query,
    setQuery,
    clearFilters: () => {
      setMethod('');
      setIncidentType('');
      setQuery('');
    },
    refresh: load
  };
}