import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import { triageId } from '../hooks/useTriageIncidents.js';

const STATUS_OPTIONS = ['', 'submitted', 'triaged', 'assigned', 'escalated', 'rejected'];
const SEVERITY_OPTIONS = ['', 'low', 'medium', 'high', 'critical'];

const SEVERITY_TONE = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' };

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function reporterLabel(incident) {
  if (typeof incident.reporter === 'string') return incident.reporter;
  return incident.reporterName ?? incident.reporter?.name ?? '—';
}

function locationLabel(incident) {
  if (incident.locationText) return incident.locationText;
  const coords = incident.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) return `${coords[0]}, ${coords[1]}`;
  return '—';
}

/**
 * TriageTable — supervisor queue of submitted field incidents.
 *
 * Columns: type, severity, location, reporter, submittedAt, status.
 * Rows from an offline device carry an "Offline" tag (`source` is
 * "offline_sync"). The wrapper scrolls horizontally on small screens.
 */
export default function TriageTable({
  incidents,
  total,
  loading,
  error,
  onRetry,
  filters,
  onFilterChange,
  onResetFilters,
  page,
  totalPages,
  onPrev,
  onNext,
  selectedId,
  onSelect
}) {
  return (
    <section aria-label="Incident triage queue" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-end gap-3 px-5 pt-4">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-stone-500">
          Status
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-medium normal-case text-stone-800"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option || 'all'} value={option}>
                {option || 'All'}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-stone-500">
          Severity
          <select
            aria-label="Filter by severity"
            value={filters.severity}
            onChange={(e) => onFilterChange('severity', e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-medium normal-case text-stone-800"
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option || 'all'} value={option}>
                {option || 'All'}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs font-bold uppercase tracking-wide text-stone-500">
          Search
          <input
            type="search"
            aria-label="Search incidents"
            placeholder="Type, reporter, location…"
            value={filters.q}
            onChange={(e) => onFilterChange('q', e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-medium normal-case tracking-normal text-stone-800"
          />
        </label>

        <Button variant="ghost" size="sm" onClick={onResetFilters}>
          Clear
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {loading ? (
          <p role="status" className="py-10 text-center text-sm font-semibold text-stone-500">
            Loading incidents…
          </p>
        ) : error ? (
          <div role="alert" className="rounded-md border border-alert-600/30 bg-alert-100 px-4 py-3">
            <p className="text-sm font-bold text-alert-600">Could not load incidents</p>
            <p className="mt-1 text-sm text-stone-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : incidents.length === 0 ? (
          <p role="status" className="py-10 text-center text-sm font-semibold text-stone-500">
            No incidents match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-stone-200">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <th scope="col" className="px-4 py-2.5">Type</th>
                  <th scope="col" className="px-4 py-2.5">Severity</th>
                  <th scope="col" className="px-4 py-2.5">Location</th>
                  <th scope="col" className="px-4 py-2.5">Reporter</th>
                  <th scope="col" className="px-4 py-2.5">Submitted</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => {
                  const id = triageId(incident);
                  const isSelected = id === selectedId;
                  return (
                    <tr
                      key={id}
                      tabIndex={0}
                      aria-selected={isSelected}
                      onClick={() => onSelect(id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(id);
                        }
                      }}
                      className={`cursor-pointer border-b border-stone-100 last:border-0 hover:bg-park-50 ${
                        isSelected ? 'bg-park-100' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-semibold text-stone-800">
                        {incident.type ?? '—'}
                        {incident.source === 'offline_sync' && (
                          <span
                            title="Submitted from an offline device"
                            className="ml-2 inline-flex items-center rounded border border-gold-500/40 bg-gold-100 px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide text-gold-500"
                          >
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {incident.severity ? (
                          <Badge tone={SEVERITY_TONE[incident.severity] ?? 'neutral'} size="sm">
                            {incident.severity}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-stone-700">{locationLabel(incident)}</td>
                      <td className="px-4 py-2.5 text-stone-700">{reporterLabel(incident)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-stone-700">
                        {formatDateTime(incident.submittedAt ?? incident.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone="neutral" size="sm">
                          {incident.status ?? 'submitted'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-stone-200 px-5 py-3 text-sm text-stone-600">
        <span role="status">
          {total} incident{total === 1 ? '' : 's'} · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={loading || page <= 1}>
            Prev
          </Button>
          <Button variant="outline" size="sm" onClick={onNext} disabled={loading || page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
