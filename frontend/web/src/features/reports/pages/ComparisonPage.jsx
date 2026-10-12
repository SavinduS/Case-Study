import { useEffect, useState } from 'react';
import { ComparisonPanel } from './ReportsPage.jsx';
import { getReport } from '../services/reportsApi.js';
import { ZONES, ZONE_LABELS, CATEGORIES, CATEGORY_LABELS, defaultCriteria, loadCriteria, saveCriteria } from '../services/criteria.js';
import Button from '../../../components/ui/Button.jsx';

export default function ComparisonPage() {
  // Real workspace criteria (last generated), never a hardcoded mock period.
  const [criteria, setCriteria] = useState(() => {
    const stored = loadCriteria() ?? defaultCriteria();
    return stored.baseline === 'none' ? { ...stored, baseline: 'previous-period' } : stored;
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate(next) {
    const active = next ?? criteria;
    if (!active.zones.length) { setError('Select at least one terrain zone before comparing.'); return; }
    setLoading(true); setError('');
    try {
      saveCriteria(active);
      setReport(await getReport(active));
    } catch (e) {
      setError(e.message); setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generate();
    // Run once on mount with the live workspace criteria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key, value) => setCriteria((current) => ({ ...current, [key]: value }));
  const toggle = (key, value) => update(key, criteria[key].includes(value) ? criteria[key].filter((x) => x !== value) : [...criteria[key], value]);

  const period = report?.criteria
    ? `${new Date(report.criteria.startDate).toISOString().slice(0, 10)} to ${new Date(report.criteria.endDate).toISOString().slice(0, 10)}`
    : `${criteria.startDate} to ${criteria.endDate}`;

  return <div className="h-full overflow-auto bg-sand-100 p-4 sm:p-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-moss-500">Park manager workspace</p>
        <h1 className="mt-1 text-2xl font-extrabold text-park-900">Comparison with baseline</h1>
        <p className="mt-1 text-sm text-stone-500">Generated live from the database for the selected period — no sample data.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-moss-500" />Current period</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-stone-300" />Baseline (previous period)</span>
          <span className="text-stone-400">Green = improvement / drop in incidents, Red = increase to watch.</span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); generate(); }} className="mb-5 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold text-stone-500">From<input aria-label="Comparison from date" type="date" value={criteria.startDate} onChange={(e) => update('startDate', e.target.value)} className="mt-1 w-full rounded border border-stone-300 p-2 text-sm" /></label>
          <label className="text-xs font-bold text-stone-500">To<input aria-label="Comparison to date" type="date" value={criteria.endDate} onChange={(e) => update('endDate', e.target.value)} className="mt-1 w-full rounded border border-stone-300 p-2 text-sm" /></label>
          <label className="text-xs font-bold text-stone-500">Baseline<select value={criteria.baseline} onChange={(e) => update('baseline', e.target.value)} className="mt-1 w-full rounded border border-stone-300 bg-white p-2 text-sm"><option value="previous-period">Previous period</option><option value="previous-year">Previous year</option></select></label>
          <div className="flex items-end"><Button type="submit" size="sm" className="w-full" aria-busy={loading}>{loading ? 'Comparing…' : 'Compare live data'}</Button></div>
        </div>
        <fieldset className="mt-4 flex flex-wrap gap-x-4 gap-y-2"><legend className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">Zones</legend>{ZONES.map((zone) => <label key={zone} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={criteria.zones.includes(zone)} onChange={() => toggle('zones', zone)} className="accent-moss-500" />{ZONE_LABELS[zone]}</label>)}</fieldset>
        <fieldset className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><legend className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">Categories</legend>{CATEGORIES.map((category) => <label key={category} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={criteria.categories.includes(category)} onChange={() => toggle('categories', category)} className="accent-moss-500" />{CATEGORY_LABELS[category]}</label>)}</fieldset>
      </form>

      {report && <p className="mb-4 text-xs text-stone-500">Live report {report.reportId || ''} · {period} · {report.status || 'complete'}</p>}
      {error && <p role="alert" className="rounded-lg bg-alert-100 p-4 text-sm text-alert-600">{error}</p>}
      {loading && !report && <div className="rounded-xl bg-white p-8 text-center text-sm text-stone-500">Loading baseline comparison…</div>}
      {report && !loading && <ComparisonPanel comparison={report.comparison} />}
    </div>
  </div>;
}
