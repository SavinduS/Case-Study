import { useEffect, useState } from 'react';
import { getZoneRecords } from '../../services/analyticsApi.js';

export default function DrillDownDrawer({ zone, onClose }) {
  const [records, setRecords] = useState([]);
  useEffect(() => { getZoneRecords(zone).then(setRecords); }, [zone]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="h-full w-[420px] max-w-[92vw] overflow-auto bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold">{zone} — underlying records</h3>
        <p className="mb-3 text-xs text-stone-500">Per-zone calculation repeated for this zone only (doc alt-flow 2).</p>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-stone-400"><th>ID</th><th>Type</th><th>Date</th><th>Patrol</th></tr></thead>
        <tbody>{records.map((r) => <tr key={r.id} className="border-t"><td>{r.id}</td><td>{r.type}</td><td>{r.date}</td><td>{r.patrol}</td></tr>)}</tbody></table>
        <div className="mt-4 flex justify-end"><button className="rounded-lg border px-4 py-2" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
