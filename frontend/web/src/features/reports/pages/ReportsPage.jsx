import { useEffect, useMemo, useState } from 'react';
import { getReport, getSavedReports, getZoneRecords, saveReport, exportReport } from '../services/reportsApi.js';
import { ZONES, ZONE_LABELS, CATEGORIES, CATEGORY_LABELS, defaultCriteria, loadCriteria, saveCriteria } from '../services/criteria.js';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';

const TYPES = [
  ['incident', 'Incident Summary', 'Incidents by category, location and time'],
  ['patrol', 'Patrol Coverage', 'Coverage, effort and response across zones'],
  ['terrain', 'Terrain Trend', 'Terrain hotspots and changes over time'],
];
const REPORT_NAMES = { incident: 'Incident summary report', patrol: 'Patrol coverage report', terrain: 'Terrain trend report', incidentSummary: 'Incident summary report', patrolCoverage: 'Patrol coverage report', terrainTrend: 'Terrain trend report' };
function reportName(report) {
  if (report.name || report.title) return report.name || report.title;
  const type = report.reportType || report.criteria?.reportType || 'overview';
  const start = report.criteria?.startDate ? new Date(report.criteria.startDate).toISOString().slice(0, 10) : '';
  const end = report.criteria?.endDate ? new Date(report.criteria.endDate).toISOString().slice(0, 10) : '';
  return `${REPORT_NAMES[type] || 'Park analytics report'}${start && end ? ` · ${start} to ${end}` : ''}`;
}

export default function ReportsPage() {
  const initial = useMemo(() => loadCriteria() ?? defaultCriteria(), []);
  const [criteria, setCriteria] = useState(initial);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [tab, setTab] = useState('incidents');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getSavedReports().catch(() => []),
      getReport(initial)
    ])
      .then(([reports, report]) => {
        if (!active) return;
        setSaved(reports);
        setResult(report);
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const data = result;
  const update = (key, value) => setCriteria((current) => ({ ...current, [key]: value }));
  const toggle = (key, value) => update(key, criteria[key].includes(value) ? criteria[key].filter((x) => x !== value) : [...criteria[key], value]);
  async function runReport(event) {
    event.preventDefault(); setLoading(true); setError(''); setNotice('');
    if (!criteria.zones.length) { setError('Select at least one terrain zone before generating a report.'); setLoading(false); return; }
    try { saveCriteria(criteria); setResult(await getReport(criteria)); } catch (e) { setError(e.message); setResult(null); } finally { setLoading(false); }
  }
  async function handleSave() {
    if (!criteria.zones.length) { setError('Select at least one terrain zone before saving a report.'); return; }
    try { saveCriteria(criteria); const item = await saveReport(criteria); setResult(item); setSaved((items) => [item, ...items]); setNotice('Report generated and saved.'); } catch (e) { setNotice(e.message); }
  }
  async function handleExport(format) {
    try {
      if (!result?.reportId) { setNotice('Generate the report before exporting.'); return; }
      setNotice(`Preparing ${format.toUpperCase()} export…`);
      await exportReport(result.reportId, format); setNotice(`${format.toUpperCase()} export downloaded successfully.`);
    } catch (e) { setNotice(e.message); }
  }
  const maxTrend = data ? Math.max(...data.trend.map(({ value }) => value), 0) : 0;
  const selectedZones = useMemo(() => criteria.zones.length, [criteria.zones]);

  return <div className="h-full overflow-auto bg-sand-100 p-4 sm:p-6">
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-moss-500">Park management analytics</p><h1 className="mt-1 text-2xl font-extrabold text-park-900">Reports workspace</h1><p className="mt-1 text-sm text-stone-500">Turn field data into clear, funder-ready decisions.</p></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => handleExport('csv')}>Export CSV</Button><Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>Export PDF</Button></div>
      </div>
      {notice && <div role="status" className="mb-4 rounded-lg border border-moss-500/30 bg-park-100 px-4 py-3 text-sm text-park-800">{notice}</div>}
      <div className="grid gap-5 lg:grid-cols-[285px_1fr]">
        <form onSubmit={runReport} className="h-fit rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-park-900">Build a report</h2><Badge tone="neutral">{selectedZones} zones</Badge></div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">Report type</label>
          <div className="space-y-2">{TYPES.map(([value, label, help]) => <label key={value} className={`block cursor-pointer rounded-lg border p-3 ${criteria.reportType === value ? 'border-moss-500 bg-park-50' : 'border-stone-200'}`}><input className="mr-2 accent-moss-500" type="radio" name="reportType" checked={criteria.reportType === value} onChange={() => update('reportType', value)} /><span className="text-sm font-semibold">{label}</span><span className="mt-1 block pl-5 text-xs text-stone-500">{help}</span></label>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-2"><label className="text-xs font-bold text-stone-500">From<input aria-label="From date" type="date" value={criteria.startDate} onChange={(e) => update('startDate', e.target.value)} className="mt-1 w-full rounded border border-stone-300 p-2 text-sm" /></label><label className="text-xs font-bold text-stone-500">To<input aria-label="To date" type="date" value={criteria.endDate} onChange={(e) => update('endDate', e.target.value)} className="mt-1 w-full rounded border border-stone-300 p-2 text-sm" /></label></div>
          <fieldset className="mt-5"><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Terrain zones</legend>{ZONES.map((zone) => <label key={zone} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={criteria.zones.includes(zone)} onChange={() => toggle('zones', zone)} className="accent-moss-500" />{ZONE_LABELS[zone]}</label>)}</fieldset>
          <fieldset className="mt-4"><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Categories</legend>{CATEGORIES.map((category) => <label key={category} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={criteria.categories.includes(category)} onChange={() => toggle('categories', category)} className="accent-moss-500" />{CATEGORY_LABELS[category]}</label>)}</fieldset>
          <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-stone-500">Baseline<select value={criteria.baseline} onChange={(e) => update('baseline', e.target.value)} className="mt-1 w-full rounded border border-stone-300 bg-white p-2 text-sm"><option value="previous-period">Previous period</option><option value="previous-year">Previous year</option><option value="none">No comparison</option></select></label>
          <div className="mt-5 flex gap-2"><Button type="submit" size="sm" className="flex-1" aria-busy={loading}>{loading ? 'Generate report (loading summary…)': 'Generate report'}</Button><Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={loading}>Save</Button></div>
          {error && <p role="alert" className="mt-3 rounded bg-alert-100 p-2 text-xs text-alert-600">{error}</p>}
          <div className="mt-5 border-t border-stone-100 pt-4"><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Saved reports</h3>{saved.length ? saved.slice(0, 4).map((item, i) => <button key={item.id || item.reportId || i} type="button" className="mb-2 block w-full truncate text-left text-sm text-moss-500 hover:underline">{reportName(item)}</button>) : <p className="text-xs text-stone-400">Your saved reports appear here.</p>}</div>
        </form>
        <section aria-label="Report results" className="min-w-0">
          {loading ? <div className="grid min-h-96 place-items-center rounded-xl bg-white text-sm text-stone-500">Loading analytics…</div> : data ? <Dashboard data={data} maxTrend={maxTrend} onZone={setDrawer} /> : <div className="grid min-h-96 place-items-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">Choose criteria and generate a report to view live analytics.</div>}
        </section>
      </div>
    </div>
    {drawer && <Drawer zone={drawer} tab={tab} setTab={setTab} criteria={criteria} onClose={() => setDrawer(null)} />}
  </div>;
}

function Dashboard({ data, maxTrend, onZone }) {
  const k = data.kpis;
  const trend = data.trend;
  const coverage = data.coverage;
  const zones = data.zones;
  const type = data.reportType === 'comparison' ? 'terrain' : data.reportType;
  const direction = data.trendDirection || (trend.length > 1 ? (trend.at(-1).value > trend[0].value ? 'Increasing' : trend.at(-1).value < trend[0].value ? 'Decreasing' : 'Stable') : 'Unavailable');
  const categoryEntries = Array.isArray(data.categoryDistribution) ? data.categoryDistribution : Object.entries(data.categoryDistribution || {}).map(([label, value]) => ({ label, value }));
  const categoryTrend = Array.isArray(data.categoryTrend) ? data.categoryTrend : Object.entries(data.categoryTrend || {}).map(([label, values]) => ({ label, values }));
  const hotspots = Array.isArray(data.terrainHotspots) && data.terrainHotspots.length ? data.terrainHotspots : zones.filter((zone) => zone.risk === 'High');
  return <div className="space-y-5">
    {data.status === 'partial' && <div role="status" className="rounded-lg border border-gold-500/40 bg-gold-100 px-4 py-3 text-sm text-park-800"><strong>Partial report:</strong> Some source data is unavailable. {(data.partialReasons || []).join(' ')}</div>}
    <div className="rounded-xl border border-moss-500/30 bg-park-50 px-4 py-3 text-sm text-park-800"><strong>{type === 'patrol' ? 'Patrol Coverage' : type === 'terrain' ? 'Terrain Trend' : 'Incident Summary'}</strong> · Live data for the selected period. Trend direction: <span className="font-bold">{direction}</span></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[['Incidents recorded', k.incidents, 'Selected period', 'text-alert-600'], ['Patrol coverage', k.patrolCoverage == null ? 'N/A' : `${k.patrolCoverage}%`, k.patrolCoverage == null ? 'Required hours not configured' : 'Against required hours', 'text-moss-500'], ['Hotspot zones', k.hotspots, 'Needs attention', 'text-gold-500'], ['Avg. response', k.responseTime == null ? '0' : `${k.responseTime} min`, 'No response records yet', 'text-park-800']].map(([label, value, sub, tone]) => <div key={label} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p><p className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</p><p className="mt-1 text-xs text-stone-500">{sub}</p></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]"><Panel title={type === 'terrain' ? 'Terrain trend' : 'Incident trend'} subtitle="Live activity in selected period"><TrendChart trend={trend} maxTrend={maxTrend} /></Panel><Panel title="Patrol coverage" subtitle="Share of zone requiring patrol"><div className="space-y-4">{coverage.map((item) => <div key={item.code}><div className="mb-1 flex justify-between text-xs"><span>{item.name}</span><strong>{item.value == null ? 'N/A' : `${item.value}%`}</strong></div><div className="h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-moss-500" style={{ width: `${item.value || 0}%` }} /></div></div>)}</div></Panel></div>
    {type === 'incident' && <div className="grid gap-5 lg:grid-cols-2"><Panel title="Category distribution" subtitle="Categories returned by the analytics API"><DataList items={categoryEntries} empty="No category distribution was returned." /></Panel><Panel title="Category-by-period trend" subtitle="Category activity over time"><DataList items={categoryTrend} empty="No category trend was returned." /></Panel></div>}
    {type === 'terrain' && <Panel title="Terrain hotspots" subtitle="Areas requiring attention"><DataList items={hotspots.map((item) => ({ label: item.name || item.code || item.zone, value: item.incidents ?? item.value ?? item.count ?? '—' }))} empty="No terrain hotspots were returned." /></Panel>}
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]"><Panel title="Incident density" subtitle="Relative concentration across the park"><div className="grid grid-cols-2 gap-2 rounded-lg bg-park-900 p-4 sm:grid-cols-4">{zones.map((zone) => <button key={zone.code} onClick={() => onZone(zone)} className="rounded-lg bg-white/10 p-3 text-left text-white hover:bg-white/20"><p className="text-xs text-white/70">{zone.name}</p><p className="mt-2 text-xl font-bold">{zone.incidents}</p><p className="text-[10px] text-white/60">incidents</p></button>)}</div></Panel><Panel title="Zone overview" subtitle="Select a zone to inspect incidents and patrols"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-stone-500"><tr><th className="pb-2">Zone</th><th className="pb-2">Incidents</th><th className="pb-2">Patrol hours</th><th className="pb-2">Risk</th></tr></thead><tbody>{zones.map((zone) => <tr key={zone.code} className="border-t border-stone-100"><td className="py-3"><button onClick={() => onZone(zone)} className="font-semibold text-moss-500 hover:underline">{zone.name}</button></td><td>{zone.incidents}</td><td>{zone.patrols.toFixed(1)}</td><td><Badge tone={zone.risk === 'High' ? 'high' : zone.risk === 'Medium' ? 'medium' : 'low'}>{zone.risk}</Badge></td></tr>)}</tbody></table></div></Panel></div>
    {data.recommendations?.length > 0 && <Panel title="Recommendations" subtitle="Actions derived from the live report"><ul className="list-disc space-y-2 pl-5 text-sm text-park-800">{data.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul></Panel>}
  </div>;
}

function Panel({ title, subtitle, children }) { return <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><h2 className="font-bold text-park-900">{title}</h2><p className="mb-4 text-xs text-stone-500">{subtitle}</p>{children}</div>; }
function TrendChart({ trend, maxTrend }) {
  if (!trend?.length) return <div className="grid h-56 place-items-center rounded-lg border border-dashed border-stone-200 text-sm text-stone-500">No trend data for this selection.</div>;
  const width = 720;
  const height = 250;
  const left = 42;
  const right = 16;
  const top = 18;
  const bottom = 48;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const step = chartWidth / Math.max(trend.length, 1);
  const barWidth = Math.min(56, Math.max(18, step * 0.58));
  const gridValues = [...new Set([0, Math.ceil(maxTrend / 2), maxTrend])];
  return <div className="overflow-x-auto">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Incident trend graph" className="h-56 min-w-[520px] w-full">
      {gridValues.map((value) => {
        const y = top + chartHeight - (maxTrend ? (value / maxTrend) * chartHeight : 0);
        return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#e9e6da" strokeDasharray="3 4" /><text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#78716c">{value}</text></g>;
      })}
      <line x1={left} x2={width - right} y1={top + chartHeight} y2={top + chartHeight} stroke="#a8a29e" />
      {trend.map(({ label, value }, index) => {
        const numericValue = Number(value) || 0;
        const barHeight = maxTrend ? (numericValue / maxTrend) * chartHeight : 0;
        const x = left + step * index + (step - barWidth) / 2;
        const y = top + chartHeight - barHeight;
        return <g key={label}>
          <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, numericValue ? 4 : 0)} rx="5" fill="#2e7d4f" opacity="0.88">
            <title>{`${label}: ${numericValue} incidents`}</title>
          </rect>
          <text x={x + barWidth / 2} y={Math.max(y - 8, 12)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#123a2d">{numericValue}</text>
          <text x={x + barWidth / 2} y={height - 20} textAnchor="middle" fontSize="10" fill="#78716c">{label}</text>
        </g>;
      })}
    </svg>
  </div>;
}
export function ComparisonPanel({ comparison }) {
  const entries = Object.entries(comparison || {});
  const groups = buildComparisonGroups(comparison || {});
  const totals = buildComparisonTotals(comparison || {});
  return <Panel title="Comparison with baseline" subtitle="Selected period compared with the previous reporting period">
    {!entries.length ? <p className="text-sm text-stone-500">No baseline comparison data was returned.</p> : <div className="space-y-4">
      {totals && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-park-50 px-3 py-2 text-sm text-park-800">
        <span className="font-semibold">Current: {totals.current}</span>
        <span className="text-stone-400">vs</span>
        <span>Baseline: {totals.baseline}</span>
        <ChangeBadge change={totals.change} percent={totals.percent} />
      </div>}
      {groups.length > 0 && <ComparisonBarChart groups={groups} />}
      {entries.map(([label, value]) => {
        const isMetric = value && typeof value === 'object' && (
          Object.prototype.hasOwnProperty.call(value, 'current')
          || Object.prototype.hasOwnProperty.call(value, 'change')
          || Object.prototype.hasOwnProperty.call(value, 'value')
        );
        const labelText = label === 'incidentCount' ? 'Incident count' : label === 'patrolCount' ? 'Patrol records' : label === 'incidentDensity' ? 'Incident density by zone' : label === 'patrolHours' ? 'Patrol hours by zone' : label;
        if (isMetric) return <ComparisonMetric key={label} label={labelText} value={value} />;
        return <div key={label} className="rounded-lg border border-stone-200 p-3"><p className="mb-2 text-sm font-semibold text-park-900">{labelText}</p><div className="grid gap-2 sm:grid-cols-2">{Object.entries(value || {}).map(([zone, metric]) => <ComparisonMetric key={zone} label={ZONE_LABELS[zone] || zone} value={metric} compact />)}</div></div>;
      })}
    </div>}
  </Panel>;
}
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function metricNumbers(metric) {
  if (metric == null || typeof metric !== 'object') return null;
  const current = metric.current ?? metric.value ?? 0;
  const baseline = metric.baseline ?? 0;
  const change = metric.variance ?? metric.change ?? (toNum(current) - toNum(baseline));
  const percent = metric.variancePercent ?? null;
  return { current: toNum(current), baseline: toNum(baseline), change: typeof change === 'number' ? change : toNum(change), percent: typeof percent === 'number' ? percent : null };
}
function buildComparisonTotals(comparison) {
  const inc = comparison.incidentCount ? metricNumbers(comparison.incidentCount) : null;
  if (!inc) return null;
  return { current: inc.current, baseline: inc.baseline, change: inc.change, percent: inc.percent };
}
function buildComparisonGroups(comparison) {
  const zoneMap = comparison.incidentDensity || comparison.patrolHours || null;
  if (zoneMap && typeof zoneMap === 'object' && !('current' in zoneMap)) {
    return Object.entries(zoneMap).map(([zone, metric]) => {
      const nums = metricNumbers(metric) || { current: 0, baseline: 0, change: 0, percent: null };
      return { label: ZONE_LABELS[zone] || zone, ...nums };
    });
  }
  const out = [];
  if (comparison.incidentCount) {
    const nums = metricNumbers(comparison.incidentCount);
    if (nums) out.push({ label: 'Incidents', ...nums });
  }
  if (comparison.patrolCount) {
    const nums = metricNumbers(comparison.patrolCount);
    if (nums) out.push({ label: 'Patrols', ...nums });
  }
  return out;
}
function ChangeBadge({ change, percent }) {
  const num = typeof change === 'number' ? change : toNum(change);
  const tone = num > 0 ? 'bg-alert-100 text-alert-600' : num < 0 ? 'bg-moss-500/10 text-moss-500' : 'bg-stone-100 text-stone-600';
  const sign = num > 0 ? '+' : '';
  const pct = typeof percent === 'number' ? ` (${percent > 0 ? '+' : ''}${percent}%)` : '';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{`${sign}${num}${pct}`}</span>;
}
function ComparisonBarChart({ groups }) {
  if (!groups?.length) return null;
  const width = 720;
  const height = 260;
  const left = 44;
  const right = 16;
  const top = 20;
  const bottom = 52;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxVal = Math.max(...groups.flatMap((g) => [g.current, g.baseline]), 0);
  const max = maxVal === 0 ? 1 : maxVal;
  const gridValues = [...new Set([0, Math.ceil(max / 2), max])];
  const groupStep = chartWidth / Math.max(groups.length, 1);
  const barWidth = Math.min(42, Math.max(16, groupStep * 0.26));
  const gap = 6;
  return <div className="rounded-lg border border-stone-200 p-3">
    <div className="mb-2 flex items-center gap-4 text-xs text-stone-500">
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-moss-500" />Current</span>
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-stone-300" />Baseline</span>
    </div>
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Current versus baseline comparison graph" className="h-56 min-w-[520px] w-full">
        {gridValues.map((value) => {
          const y = top + chartHeight - (value / max) * chartHeight;
          return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#e9e6da" strokeDasharray="3 4" /><text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#78716c">{value}</text></g>;
        })}
        <line x1={left} x2={width - right} y1={top + chartHeight} y2={top + chartHeight} stroke="#a8a29e" />
        {groups.map((g, index) => {
          const cx = left + groupStep * index + groupStep / 2;
          const curH = (g.current / max) * chartHeight;
          const baseH = (g.baseline / max) * chartHeight;
          const curX = cx - barWidth - gap / 2;
          const baseX = cx + gap / 2;
          return <g key={g.label}>
            <rect x={curX} y={top + chartHeight - curH} width={barWidth} height={Math.max(curH, g.current ? 4 : 0)} rx="5" fill="#2e7d4f" opacity="0.9">
              <title>{`${g.label} current: ${g.current}`}</title>
            </rect>
            <rect x={baseX} y={top + chartHeight - baseH} width={barWidth} height={Math.max(baseH, g.baseline ? 4 : 0)} rx="5" fill="#d6d0bd">
              <title>{`${g.label} baseline: ${g.baseline}`}</title>
            </rect>
            <text x={curX + barWidth / 2} y={Math.max(top + chartHeight - curH - 6, 12)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#123a2d">{g.current}</text>
            <text x={baseX + barWidth / 2} y={Math.max(top + chartHeight - baseH - 6, 12)} textAnchor="middle" fontSize="10" fill="#78716c">{g.baseline}</text>
            <text x={cx} y={height - 28} textAnchor="middle" fontSize="10" fill="#78716c">{g.label.length > 14 ? `${g.label.slice(0, 13)}…` : g.label}</text>
            <text x={cx} y={height - 14} textAnchor="middle" fontSize="10" fontWeight="700" fill={g.change > 0 ? '#b3402a' : g.change < 0 ? '#2e7d4f' : '#78716c'}>{`${g.change > 0 ? '+' : ''}${g.change}${typeof g.percent === 'number' ? ` (${g.percent > 0 ? '+' : ''}${g.percent}%)` : ''}`}</text>
          </g>;
        })}
      </svg>
    </div>
  </div>;
}
function ComparisonMetric({ label, value, compact = false }) {
  const variance = value.variance ?? value.value ?? value.change ?? 0;
  const percent = value.variancePercent ?? (typeof value.change === 'string' && value.change.includes('%') ? value.change : null);
  const varianceClass = variance > 0 ? 'text-alert-600' : variance < 0 ? 'text-moss-500' : 'text-stone-600';
  return <div className={`rounded-lg bg-sand-100 ${compact ? 'p-2' : 'p-3'}`}>
    <p className="text-xs font-semibold text-stone-600">{label}</p>
    <div className="mt-2 flex items-end justify-between gap-3">
      <div><p className="text-[10px] uppercase tracking-wide text-stone-400">Current</p><p className="text-lg font-bold text-park-900">{value.current ?? '—'}</p></div>
      <div><p className="text-[10px] uppercase tracking-wide text-stone-400">Baseline</p><p className="text-sm font-semibold text-stone-600">{value.baseline ?? '—'}</p></div>
      <div className="text-right"><p className="text-[10px] uppercase tracking-wide text-stone-400">Change</p><p className={`text-sm font-bold ${varianceClass}`}>{typeof variance === 'string' ? variance : `${variance > 0 ? '+' : ''}${variance}`}{percent == null || typeof variance === 'string' ? '' : ` (${typeof percent === 'number' && percent > 0 ? '+' : ''}${percent}${typeof percent === 'number' ? '%' : ''})`}</p></div>
    </div>
    {percent == null && <p className="mt-2 text-[10px] text-stone-500">No baseline records were available for percentage comparison.</p>}
  </div>;
}
function DataList({ items, empty }) {
  if (!items?.length) return <p className="text-sm text-stone-500">{empty}</p>;
  return <div className="space-y-2">{items.map((item, index) => <div key={item.label || index} className="flex items-center justify-between rounded-lg bg-sand-100 px-3 py-2 text-sm"><span>{item.label || item.period || item.category || 'Value'}</span><strong>{formatValue(item.value ?? item.values ?? item.change ?? '—')}</strong></div>)}</div>;
}
function formatValue(value) {
  if (value == null) return '—';
  if (typeof value !== 'object') return String(value);
  return Object.entries(value).map(([key, entry]) => `${key}: ${formatValue(entry)}`).join(' · ');
}
function Drawer({ zone, tab, setTab, criteria, onClose }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getZoneRecords(zone.code, criteria.startDate, criteria.endDate)
      .then(setRecords)
      .catch((e) => setError(e.message));
  }, [zone.code, criteria.startDate, criteria.endDate]);
  const items = records ? (tab === 'incidents' ? records.incidents : records.patrols) : [];
  return <div className="fixed inset-0 z-[900] flex justify-end bg-black/30" onClick={onClose}><aside role="dialog" aria-label={`${zone.name} details`} className="h-full w-full max-w-md overflow-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-moss-500">Zone drill-down</p><h2 className="mt-1 text-xl font-extrabold text-park-900">{zone.name}</h2><p className="text-sm text-stone-500">{zone.incidents} incidents · {zone.patrols.toFixed(1)} patrol hours</p></div><button aria-label="Close drawer" onClick={onClose} className="text-2xl text-stone-400">×</button></div><div className="mt-6 flex border-b border-stone-200"><button className={`flex-1 border-b-2 p-3 text-sm font-semibold ${tab === 'incidents' ? 'border-moss-500 text-moss-500' : 'border-transparent text-stone-500'}`} onClick={() => setTab('incidents')}>Incidents</button><button className={`flex-1 border-b-2 p-3 text-sm font-semibold ${tab === 'patrol' ? 'border-moss-500 text-moss-500' : 'border-transparent text-stone-500'}`} onClick={() => setTab('patrol')}>Patrol activity</button></div><div className="mt-5 space-y-3">{!records && !error && <p className="text-sm text-stone-500">Loading zone records…</p>}{error && <p role="alert" className="rounded bg-alert-100 p-2 text-sm text-alert-600">{error}</p>}{records && !items.length && <p className="text-sm text-stone-500">No {tab} records for this selection.</p>}{items.map((record, index) => { const date = record.createdAt || record.startedAt || record.patrolDate || record.date; return <div key={record._id || index} className="rounded-lg border border-stone-200 p-3"><div className="flex justify-between text-xs text-stone-500"><span>{date ? new Date(date).toLocaleDateString() : 'Undated'}</span><Badge tone="low">Recorded</Badge></div><p className="mt-2 text-sm font-semibold text-park-800">{record.type || record.sector || 'Patrol record'}</p><p className="mt-1 text-xs text-stone-500">{record.description || `${Number(record.hours || record.durationHours || 0).toFixed(1)} hours`}</p></div>; })}</div></aside></div>;
}
