export default function ZoneTable({ rows, onDrill }) {
  return (
    <table><thead><tr><th>Zone</th><th>Patrols</th><th>Coverage</th><th>Incidents</th><th>Density</th><th>Status</th></tr></thead>
    <tbody>{rows.map((r) => (
      <tr key={r.zone}><td><button className="btn" onClick={() => onDrill(r.zone)}>{r.zone}</button></td>
      <td>{r.patrols}</td><td>{r.coverage}%</td><td>{r.incidents}</td><td>{r.density} /km²</td>
      <td><span className={`badge ${r.status === 'On target' ? 'ok' : r.status === 'Watch' ? 'warn' : 'bad'}`}>{r.status}</span></td></tr>
    ))}</tbody></table>
  );
}
