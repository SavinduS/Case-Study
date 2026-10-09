import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/ui/Button.jsx';
import { getSavedReports } from '../services/reportsApi.js';

const REPORT_NAMES = { incident: 'Incident summary report', patrol: 'Patrol coverage report', terrain: 'Terrain trend report', incidentSummary: 'Incident summary report', patrolCoverage: 'Patrol coverage report', terrainTrend: 'Terrain trend report' };
function reportName(report) {
  if (report.name || report.title) return report.name || report.title;
  const type = report.reportType || report.criteria?.reportType || 'overview';
  const start = report.criteria?.startDate ? new Date(report.criteria.startDate).toISOString().slice(0, 10) : '';
  const end = report.criteria?.endDate ? new Date(report.criteria.endDate).toISOString().slice(0, 10) : '';
  return `${REPORT_NAMES[type] || 'Park analytics report'}${start && end ? ` · ${start} to ${end}` : ''}`;
}

export default function SavedReportsPage() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getSavedReports().then(setReports).catch((e) => setError(e.message)); }, []);
  return <div className="h-full overflow-auto bg-sand-100 p-4 sm:p-8"><div className="mx-auto max-w-5xl">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-moss-500">Park manager workspace</p><h1 className="mt-1 text-2xl font-extrabold text-park-900">Saved reports</h1><p className="mt-1 text-sm text-stone-500">Quickly reopen the views your team uses most.</p></div><Link to="/analytics/type"><Button size="sm">Build a report</Button></Link></div>
    {error && <p role="alert" className="rounded-lg bg-alert-100 p-4 text-sm text-alert-600">{error}</p>}
    {!reports && !error && <div className="rounded-xl bg-white p-8 text-center text-sm text-stone-500">Loading saved reports…</div>}
    {reports?.length === 0 && <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center"><p className="font-semibold text-park-900">No saved reports yet</p><p className="mt-1 text-sm text-stone-500">Generate a report and select Save to keep it here.</p></div>}
    {reports?.length > 0 && <div className="grid gap-3 md:grid-cols-2">{reports.map((report, i) => <article key={report.id || report.reportId || i} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><h2 className="font-bold text-park-900">{reportName(report)}</h2><p className="mt-1 text-sm text-stone-500">{report.reportType || report.criteria?.reportType || 'Analytics report'} · {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Saved report'}</p><Link className="mt-4 inline-block text-sm font-semibold text-moss-500 hover:underline" to="/analytics/type">Open in workspace →</Link></article>)}</div>}
  </div></div>;
}
