import { useNavigate } from 'react-router-dom';
import StepsPill from '../../components/analytics/StepsPill.jsx';
import { Card } from '../../components/analytics/Card.jsx';

const TYPES = [
  { id: 'coverage', name: 'Patrol Coverage Report', desc: 'Coverage, incident density and trend per terrain zone.', ready: true },
  { id: 'incidents', name: 'Incident Summary Report', desc: 'Counts by category, zone and week.', ready: false },
  { id: 'trend', name: 'Terrain Trend Report', desc: 'Period-over-period variance and hotspots.', ready: false }
];

export default function ReportTypePage() {
  const nav = useNavigate();
  return (
    <div>
      <div className="text-xs text-stone-400">Analytics / Generate report</div>
      <h1 className="text-2xl font-extrabold">Select report type</h1>
      <StepsPill step={1} />
      <div className="grid gap-4 md:grid-cols-3">
        {TYPES.map((t) => (
          <Card key={t.id} title={t.name}>
            <p className="mb-4 text-sm text-stone-500">{t.desc}</p>
            {t.ready
              ? <button className="rounded-lg bg-park-900 px-4 py-2 text-sm font-semibold text-white hover:bg-park-800" onClick={() => nav('/analytics/criteria')}>Select →</button>
              : <button disabled className="cursor-not-allowed rounded-lg bg-stone-100 px-4 py-2 text-sm text-stone-400">Coming soon</button>}
          </Card>
        ))}
      </div>
    </div>
  );
}
