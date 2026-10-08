export default function CompareTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm"><thead><tr className="text-left text-xs text-stone-400"><th>Zone</th><th>Current</th><th>Baseline</th><th>Change</th></tr></thead>
      <tbody>{rows.map((r) => { const d = r.incidents - r.prev; return (
        <tr key={r.zone} className="border-t"><td className="font-semibold">{r.zone}</td><td>{r.incidents}</td><td>{r.prev}</td>
        <td className={d > 0 ? 'font-bold text-clay-500' : 'font-bold text-moss-500'}>{d >= 0 ? `+${d}` : d}</td></tr>); })}</tbody></table>
    </div>
  );
}
