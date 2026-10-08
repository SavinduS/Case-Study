export default function KpiCard({ label, value, sub }) {
  return <div className="card"><div style={{fontSize:12,opacity:.7}}>{label}</div><div style={{fontSize:28,fontWeight:800}}>{value}</div><div style={{fontSize:12}}>{sub}</div></div>;
}
