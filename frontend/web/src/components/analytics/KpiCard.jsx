export default function KpiCard({ label, value, sub, tone = 'text-clay-500' }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-3xl font-extrabold text-stone-900">{value}</div>
      <div className={`text-xs font-semibold ${tone}`}>{sub}</div>
    </div>
  );
}
