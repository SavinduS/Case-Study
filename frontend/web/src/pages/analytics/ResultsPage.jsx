import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StepsPill from '../../components/analytics/StepsPill.jsx';
import KpiCard from '../../components/analytics/KpiCard.jsx';
import TrendChart from '../../components/analytics/TrendChart.jsx';
import CoverageBars from '../../components/analytics/CoverageBars.jsx';
import ZoneTable from '../../components/analytics/ZoneTable.jsx';
import DensityMap from '../../components/analytics/DensityMap.jsx';
import DrillDownDrawer from '../../components/analytics/DrillDownDrawer.jsx';
import CompareTable from '../../components/analytics/CompareTable.jsx';
import ExportButtons from '../../components/analytics/ExportButtons.jsx';
import { Card } from '../../components/analytics/Card.jsx';
import { generateReport } from '../../services/analyticsApi.js';

export default function ResultsPage() {
  const nav = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [drillZone, setDrillZone] = useState('');

  useEffect(() => {
    const criteria = JSON.parse(sessionStorage.getItem('criteria') || '{"zones":["Sector 7","Riverbank","Highland","Farmland buffer"],"categories":["elephant","crop","poacher","snare"]}');
    generateReport(criteria).then(setReport)
      .catch((e) => setError(e.code === 'NO_DATA' ? 'No incident or patrol records for the selected criteria. Adjust criteria and generate again.' : 'Central database unavailable. Retry when available.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-2xl bg-white p-10 text-center shadow-sm">Compiling analytics…</div>;
  if (error) return (<div><StepsPill step={3} /><div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div><button className="mt-3 rounded-lg border px-4 py-2" onClick={() => nav('/analytics/criteria')}>Edit criteria</button></div>);

  return (
    <div>
      <div className="text-xs text-stone-400">Analytics / Generate report / Results</div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-extrabold">{report.title}</h1>
        <div className="text-xs text-stone-500">Report {report.id} · 4 terrain zones · compiled 15 Jun 2023 at 10:04 {report.status === 'partial' && <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Partial — patrol data incomplete</span>}</div></div>
      </div>
      <StepsPill step={3} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title="Incidents over the period" action={<span className="text-xs text-stone-400">Weekly</span>}><TrendChart data={report.weekly} /></Card>
          <Card title="Patrol coverage by zone" action={<span className="text-xs text-stone-400">Target 75%</span>}><CoverageBars data={report.perZone} /></Card>
          <Card title="Zone breakdown" action={<span className="text-xs text-stone-400">{report.perZone.length} zones</span>}><ZoneTable rows={report.perZone} onDrill={setDrillZone} /></Card>
          {report.compare && <Card title={`Period compare vs ${report.compare.baseline}`}><CompareTable rows={report.compare.rows} /></Card>}
        </div>
        <div className="space-y-4">
          <KpiCard label="Incidents recorded" value={report.summary.incidents} sub="▲ 12% vs May" />
          <KpiCard label="Patrols logged" value={report.summary.patrols} sub="▲ 4% vs May" tone="text-moss-500" />
          <KpiCard label="Average coverage" value={`${report.summary.avgCoverage}%`} sub="▼ 2 pts vs target" />
          <Card title="Incident density"><DensityMap rows={report.perZone} /></Card>
          <div className="rounded-2xl border-l-4 border-clay-500 bg-orange-50 p-4 text-xs"><b>Attention needed</b><p className="mt-1 text-stone-600">Farmland buffer has the highest incident density and the lowest coverage. Consider adding a second patrol shift.</p></div>
          <div className="rounded-2xl border-l-4 border-moss-500 bg-emerald-50 p-4 text-xs"><b>How coverage is measured</b><p className="mt-1 text-stone-600">Patrolled hours divided by required hours for the zone. Density is incidents per square kilometre.</p></div>
        </div>
      </div>
      <div className="mt-3 text-xs text-stone-400">Generated from {report.summary.incidents} incidents and {report.summary.patrols} patrol records</div>
      <div className="mt-2 flex justify-end gap-2">
        <button className="rounded-lg border bg-white px-4 py-2.5 text-sm" onClick={() => nav('/analytics/criteria')}>Edit criteria</button>
        <ExportButtons report={report} />
      </div>
      {drillZone && <DrillDownDrawer zone={drillZone} onClose={() => setDrillZone('')} />}
    </div>
  );
}
