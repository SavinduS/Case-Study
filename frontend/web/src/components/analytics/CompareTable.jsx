export default function CompareTable({ rows }) {
  return (
    <table><thead><tr><th>Zone</th><th>Current</th><th>Baseline</th><th>Change</th></tr></thead>
    <tbody>{rows.map((r) => <tr key={r.zone}><td>{r.zone}</td><td>{r.incidents}</td><td>{r.prev}</td><td>{r.incidents - r.prev >= 0 ? '+' : ''}{r.incidents - r.prev}</td></tr>)}</tbody></table>
  );
}
