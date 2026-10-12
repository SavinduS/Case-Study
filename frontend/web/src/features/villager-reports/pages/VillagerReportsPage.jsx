import { useState } from 'react';
import Badge from '../../../components/ui/Badge.jsx';
import {
  CONFLICT_TYPE_HELP,
  CONFLICT_TYPE_LABEL,
  CONFLICT_TYPE_ORDER,
  CONFLICT_TYPE_TONE,
  SUBMISSION_METHOD,
  SUBMISSION_METHOD_LABEL,
  ageInDays,
  conflictStatusLabel,
  conflictTypeLabel,
  formatReportStamp,
  isOpenConflict,
  submissionMethodLabel
} from '../domain/labels.js';

/**
 * Channel tab strip: All reports / SMS hotline / Field app.
 *
 * The two channels are separated because the SMS gateway produces a materially
 * poorer record than the field app — no photo, no GPS accuracy, sometimes no
 * description — and an officer triaging the hotline needs to see that gap
 * rather than infer it from an empty field on a mixed list.
 */
function MethodTabs({ method, setMethod, byMethod, total }) {
  const tabs = [
    { key: '', label: 'All reports', count: total, hint: 'Every channel combined' },
    { key: SUBMISSION_METHOD.SMS, label: SUBMISSION_METHOD_LABEL[SUBMISSION_METHOD.SMS], count: byMethod[SUBMISSION_METHOD.SMS] ?? 0, hint: 'Verbal reports taken by the hotline' },
    { key: SUBMISSION_METHOD.APP, label: SUBMISSION_METHOD_LABEL[SUBMISSION_METHOD.APP], count: byMethod[SUBMISSION_METHOD.APP] ?? 0, hint: 'Reports submitted with location and photo' }
  ];

  return (
    <div role="group" aria-label="Filter by how the report arrived" className="grid gap-2 sm:grid-cols-3">
      {tabs.map((tab) => {
        const active = method === tab.key;
        return (
          <button
            key={tab.key || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => setMethod(tab.key)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              active
                ? 'border-moss-500 bg-park-50 shadow-sm'
                : 'border-stone-200 bg-white hover:border-moss-500/40'
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{tab.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${active ? 'text-moss-500' : 'text-park-900'}`}>
              {tab.count}
            </p>
            <p className="mt-1 text-xs text-stone-500">{tab.hint}</p>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Category grid. Doubles as the filter: picking a type narrows the list below.
 * Only types that actually have reports are shown, so an empty category never
 * occupies a slot the officer reads as "none received" when it is really
 * "never possible".
 */
function CategoryGrid({ byType, incidentType, setIncidentType }) {
  const present = CONFLICT_TYPE_ORDER.filter((type) => byType[type]);

  if (present.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
        No categories to show — nothing has been reported yet.
      </p>
    );
  }

  return (
    <div role="group" aria-label="Filter by incident type" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {present.map((type) => {
        const active = incidentType === type;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => setIncidentType(active ? '' : type)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              active ? 'border-moss-500 bg-park-50' : 'border-stone-200 bg-white hover:bg-park-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Badge tone={CONFLICT_TYPE_TONE[type] ?? 'neutral'} size="sm">
                {CONFLICT_TYPE_LABEL[type] ?? conflictTypeLabel(type)}
              </Badge>
              <strong className="text-lg font-extrabold text-park-900">{byType[type]}</strong>
            </div>
            <p className="mt-1.5 text-xs text-stone-500">{CONFLICT_TYPE_HELP[type]}</p>
          </button>
        );
      })}
    </div>
  );
}

/** One report card. Collapsed shows what decides priority; the rest is a click away. */
function ReportCard({ report, expanded, onToggle }) {
  const open = isOpenConflict(report);
  const age = ageInDays(report.createdAt);
  const isSms = report.submissionMethod === SUBMISSION_METHOD.SMS;

  return (
    <li className={`rounded-xl border bg-white shadow-sm transition-colors ${expanded ? 'border-moss-500' : 'border-stone-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full p-4 text-left"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={CONFLICT_TYPE_TONE[report.incidentType] ?? 'neutral'} size="sm">
                {conflictTypeLabel(report.incidentType)}
              </Badge>
              <span className="rounded bg-sand-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">
                {submissionMethodLabel(report.submissionMethod)}
              </span>
              {!open && (
                <span className="rounded bg-park-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-park-800">
                  Resolved
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-bold text-park-900">
              {report.locationText ?? 'Location not named by the villager'}
            </p>
            {report.description && (
              <p className="mt-1 line-clamp-2 text-xs text-stone-600">{report.description}</p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="font-mono text-[11px] text-stone-500">{formatReportStamp(report.createdAt)}</p>
            {age !== null && (
              <p className={`mt-0.5 text-[11px] font-semibold ${age > 7 ? 'text-alert-600' : 'text-stone-400'}`}>
                {age === 0 ? 'Today' : `${age} day${age === 1 ? '' : 's'} ago`}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          <span className="font-mono text-[11px] text-stone-400">{report.reportId}</span>

          {/* The flags the server raised. An SMS report with no photo is the
              normal case, not a defect, so it is only called out as a gap when
              the officer is looking at that channel. */}
          {report.isPossibleDuplicate && (
            <span className="rounded bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-500">
              Possible duplicate
            </span>
          )}
          {report.outsideSupportedArea && (
            <span className="rounded bg-alert-100 px-1.5 py-0.5 text-[10px] font-bold text-alert-600">
              Outside supported area
            </span>
          )}
          {isSms && !report.photoUrl && (
            <span className="rounded bg-sand-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">
              No photo attached
            </span>
          )}
          {report.accuracyMeters != null && (
            <span className="text-[10px] text-stone-400">±{Math.round(report.accuracyMeters)} m accuracy</span>
          )}

          <span className="ml-auto text-[11px] font-semibold text-moss-500">
            {expanded ? 'Hide details' : 'View details'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-200 bg-sand-100 p-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Status</dt>
              <dd className="mt-0.5 text-sm font-semibold text-park-900">
                {conflictStatusLabel(report.status)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Villager contact</dt>
              <dd className="mt-0.5 font-mono text-sm text-park-900">
                {report.reporterContact ?? 'not supplied'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Reported via</dt>
              <dd className="mt-0.5 text-sm text-park-900">{submissionMethodLabel(report.submissionMethod)}</dd>
            </div>
          </dl>

          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Villager's account</p>
            {report.description ? (
              <p className="mt-1 border-l-2 border-stone-300 pl-3 text-sm text-stone-700">
                {report.description}
              </p>
            ) : (
              <p className="mt-1 border-l-2 border-stone-300 pl-3 text-sm text-stone-500">
                {isSms
                  ? 'Taken over the hotline without a written description — confirm details by calling.'
                  : 'The villager filed this without a description.'}
              </p>
            )}
          </div>

          {report.photoUrl ? (
            <img
              src={report.photoUrl}
              alt={`Photo attached to villager report ${report.reportId}`}
              className="mt-3 max-h-56 rounded-lg border border-stone-300 bg-white"
            />
          ) : null}

          {/* Coordinates last: the place name is what the officer acts on, and
              this is the field they only need when the name is missing. */}
          {report.location?.coordinates?.length === 2 && (
            <p className="mt-3 font-mono text-[11px] text-stone-400">
              {report.location.coordinates[1].toFixed(4)} N, {report.location.coordinates[0].toFixed(4)} E
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Right-hand filter rail: search, category reset and the channel mix. */
function FilterRail({ hook }) {
  const { byMethod, byType, query, setQuery, incidentType, clearFilters, stats } = hook;
  const filterActive = Boolean(query || incidentType);

  return (
    <aside aria-label="Report filters" className="h-fit rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-park-900">Filters</h2>
        {filterActive && (
          <button type="button" onClick={clearFilters} className="text-xs font-semibold text-moss-500 hover:underline">
            Clear
          </button>
        )}
      </div>

      <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-stone-500">
        Search reports
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Reference, place or keyword"
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm normal-case text-stone-900"
        />
      </label>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Channel mix</h3>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-stone-600">SMS hotline</dt>
            <dd className="font-bold text-park-900">{stats.sms}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-stone-600">Field app</dt>
            <dd className="font-bold text-park-900">{stats.app}</dd>
          </div>
        </dl>
      </div>

      {Object.keys(byType).length > 0 && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">By category</h3>
          <dl className="mt-2 space-y-1.5 text-sm">
            {CONFLICT_TYPE_ORDER.filter((type) => byType[type]).map((type) => (
              <div key={type} className="flex items-center justify-between gap-2">
                <dt className="truncate text-stone-600">{CONFLICT_TYPE_LABEL[type]}</dt>
                <dd className="font-bold text-park-900">{byType[type]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {stats.duplicates > 0 && (
        <p className="mt-4 rounded-lg bg-gold-100 px-3 py-2 text-xs text-park-800">
          <strong>{stats.duplicates}</strong> report{stats.duplicates === 1 ? '' : 's'} the server
          flagged as a possible duplicate of an earlier report.
        </p>
      )}
      {stats.outsideArea > 0 && (
        <p className="mt-2 rounded-lg bg-alert-100 px-3 py-2 text-xs text-park-800">
          <strong>{stats.outsideArea}</strong> report{stats.outsideArea === 1 ? '' : 's'} came from
          outside the supported reporting area.
        </p>
      )}
    </aside>
  );
}

export default function VillagerReportsPage({ hook }) {
  const [expandedId, setExpandedId] = useState(null);

  const {
    loading,
    error,
    lastUpdatedAt,
    visibleReports,
    stats,
    byMethod,
    byType,
    method,
    setMethod,
    incidentType,
    setIncidentType,
    refresh
  } = hook;

  return (
    <div className="h-full overflow-auto bg-sand-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-moss-500">Community reports</p>
            <h1 className="mt-1 text-2xl font-extrabold text-park-900">Villager reports</h1>
            <p className="mt-1 text-sm text-stone-500">
              Wildlife conflict reported by people living around the park, separated by how it reached us.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-park-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-alert-600/40 bg-alert-100 px-4 py-3 text-sm text-alert-600">
            <strong>Cannot load villager reports.</strong> {error}
          </div>
        )}

        {/* Headline figures. Every count here comes from the same unfiltered set,
            so the numbers never disagree with each other. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Reports received" value={stats.total} sub="Across every channel" tone="text-park-900" />
          <StatTile label="Awaiting action" value={stats.open} sub="Not yet resolved" tone="text-alert-600" />
          <StatTile label="SMS hotline" value={stats.sms} sub="Verbal reports" tone="text-gold-500" />
          <StatTile label="Field app" value={stats.app} sub="Location and photo" tone="text-moss-500" />
        </div>

        <section aria-label="Reports by channel" className="mt-5">
          <h2 className="mb-2 font-bold text-park-900">How the report arrived</h2>
          <MethodTabs method={method} setMethod={setMethod} byMethod={byMethod} total={stats.total} />
        </section>

        <section aria-label="Reports by category" className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-bold text-park-900">What was reported</h2>
            {incidentType && (
              <span className="text-xs text-stone-500">Filtered to one category — select it again to clear</span>
            )}
          </div>
          <CategoryGrid byType={byType} incidentType={incidentType} setIncidentType={setIncidentType} />
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[285px_1fr]">
          <FilterRail hook={hook} />

          <section aria-label="Villager report list" className="min-w-0">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold text-park-900">
                {visibleReports.length} report{visibleReports.length === 1 ? '' : 's'}
              </h2>
              {lastUpdatedAt && (
                <p className="text-xs text-stone-500">Last refreshed at {formatReportStamp(lastUpdatedAt)}</p>
              )}
            </div>

            {loading ? (
              <div className="grid min-h-64 place-items-center rounded-xl border border-stone-200 bg-white text-sm text-stone-500">
                Loading villager reports…
              </div>
            ) : visibleReports.length === 0 ? (
              <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
                {stats.total === 0
                  ? 'No villager reports have been received yet. They appear here as soon as a villager submits one from the field app or the SMS hotline.'
                  : 'No reports match these filters. Clear the search or category filter to see the rest.'}
              </div>
            ) : (
              <ul className="space-y-2">
                {visibleReports.map((report) => (
                  <ReportCard
                    key={report.reportId}
                    report={report}
                    expanded={expandedId === report.reportId}
                    onToggle={() =>
                      setExpandedId((current) => (current === report.reportId ? null : report.reportId))
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, tone }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-stone-500">{sub}</p>
    </div>
  );
}