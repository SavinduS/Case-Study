import StepsPill from '../../components/analytics/StepsPill.jsx';

const SAVED = [{ id: 'R-2201', title: 'Patrol analytics, 1-30 June 2023', status: 'complete' }];

export default function SavedReportsPage() {
  return (
    <div>
      <h2>Analytics / Saved reports</h2>
      <StepsPill step={4} />
      <div className="card">
        <table><thead><tr><th>ID</th><th>Title</th><th>Status</th></tr></thead>
        <tbody>{SAVED.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.title}</td><td><span className="badge ok">{r.status}</span></td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
