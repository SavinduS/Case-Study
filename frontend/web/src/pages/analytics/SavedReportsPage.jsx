import StepsPill from '../../components/analytics/StepsPill.jsx';
import { Card } from '../../components/analytics/Card.jsx';

const SAVED = [{ id: 'R-2201', title: 'Patrol analytics, 1-30 June 2023', meta: '4 terrain zones · compiled 15 Jun 2023', status: 'complete' }];

export default function SavedReportsPage() {
  return (
    <div>
      <div className="text-xs text-stone-400">Analytics / Saved reports</div>
      <h1 className="text-2xl font-extrabold">Saved reports</h1>
      <StepsPill step={4} />
      <Card>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase text-stone-400"><th className="py-2">ID</th><th>Title</th><th>Status</th></tr></thead>
        <tbody>{SAVED.map((r) => <tr key={r.id} className="border-t"><td className="py-2 font-bold">{r.id}</td><td>{r.title}<div className="text-xs text-stone-400">{r.meta}</div></td><td><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">{r.status}</span></td></tr>)}</tbody></table>
      </Card>
    </div>
  );
}
