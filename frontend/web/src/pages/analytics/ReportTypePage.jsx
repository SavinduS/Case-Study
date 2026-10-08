import { useNavigate } from 'react-router-dom';
import StepsPill from '../../components/analytics/StepsPill.jsx';

export default function ReportTypePage() {
  const nav = useNavigate();
  return (
    <div>
      <h2>Analytics / Generate report</h2>
      <StepsPill step={1} />
      <div className="grid3">
        <div className="card"><h3>Patrol Coverage Report</h3><p>Coverage, density and trend per terrain zone.</p><button className="btn primary" onClick={() => nav('/analytics/criteria')}>Select</button></div>
        <div className="card"><h3>Incident Summary</h3><p>Counts by category and zone.</p><button className="btn" disabled>Coming soon</button></div>
        <div className="card"><h3>Terrain Trend</h3><p>Period-over-period variance.</p><button className="btn" disabled>Coming soon</button></div>
      </div>
    </div>
  );
}
