const pill = (s) =>
  s === 'On target' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  : s === 'Watch' ? 'bg-gold-100 text-yellow-800 ring-yellow-200'
  : 'bg-red-50 text-red-700 ring-red-200';

export default function ZoneTable({ rows, onDrill }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-stone-400"><th className="py-2">Zone</th><th>Patrols</th><th>Coverage</th><th>Incidents</th><th>Density</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.zone} className="border-t border-stone-100 hover:bg-stone-50">
              <td className="py-2 font-semibold"><button className="text-park-800 underline decoration-park-100 underline-offset-2 hover:decoration-park-700" onClick={() => onDrill(r.zone)}>{r.zone}</button></td>
              <td>{r.patrols}</td><td>{r.coverage}%</td><td>{r.incidents}</td><td>{r.density} /km²</td>
              <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pill(r.status)}`}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
