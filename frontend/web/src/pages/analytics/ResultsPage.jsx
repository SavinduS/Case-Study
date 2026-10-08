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
import { generateReport } from '../../services/analyticsApi.js';

export default function ResultsPage() {
  const nav = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [drillZone, setDrillZone] = useState('');

  useEffect(() => {
    const criteria = JSON.parse(sessionStorage.getItem('criteria') || '{"zones":["Sector 7","Riverbank","Highland","Farmland buffer"],"categories":["elephant","crop","poacher","snare"]}');
    generateReport(criteria)
      .then(setReport)
      .catch((e) => setError(e.code === 'NO_DATA' ? 'No incident or patrol records for the selected criteria. Adjust criteria and generate again.' : 'Central database unavailable. Retry when available.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card">Generating report…</div>;
  if (error) return (<div><StepsPill step={3} /><div className="err">{error}</div><button className="btn" onClick={() => nav('/analytics/criteria')}>Edit criteria</button></div>);
  if (!report) return null;

  return (
    <div>
      <div>Analytics / Generate report / Results</div>
      <h2>{report.title}</h2>
      <div>Report {report.id} · 4 terrain zones {report.status === 'partial' && <span className="badge warn">Partial — patrol data incomplete</span>}</div>
      <StepsPill step={3} />
      <div className="grid2">
        <div>
          <div className="card"><h3>Incidents over the period</h3><TrendChart data={report.weekly} /></div>
          <div className="card"><h3>Patrol coverage by zone (Target 75%)</h3><CoverageBars data={report.perZone} /></div>
          <div className="card"><h3>Zone breakdown</h3><ZoneTable rows={report.perZone} onDrill={setDrillZone} /></div>
          {report.compare && <div className="card"><h3>Period compare vs {report.compare.baseline}</h3><CompareTable rows={report.compare.rows} /></div>}
        </div>
        <div>
          <KpiCard label="Incidents recorded" value={report.summary.incidents} sub="+12% vs May" />
          <KpiCard label="Patrols logged" value={report.summary.patrols} sub="+4% vs May" />
          <KpiCard label="Average coverage" value={`${report.summary.avgCoverage}%`} sub="2 pts vs target" />
          <div className="card"><h3>Incident density</h3><DensityMap rows={report.perZone} /></div>
          <div className="card"><b>Attention needed</b><p>Farmland buffer has the highest incident density and the lowest coverage. Consider adding a second patrol shift.</p></div>
          <div className="card"><b>How coverage is measured</b><p>Patrolled hours divided by required hours for the zone. Density is incidents per square kilometre.</p></div>
        </div>
      </div>
      <div>Generated from {report.summary.incidents} incidents and {report.summary.patrols} patrol records</div>
      <div className="btnrow">
        <button className="btn" onClick={() => nav('/analytics/criteria')}>Edit criteria</button>
        <ExportButtons report={report} />
        <button className="btn" onClick={() => nav('/analytics/saved')}>Saved reports</button>
      </div>
      {drillZone && <DrillDownDrawer zone={drillZone} onClose={() => setDrillZone('')} />}
    </div>
  );
}
