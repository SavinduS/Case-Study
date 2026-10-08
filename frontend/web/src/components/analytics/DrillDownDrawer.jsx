import { useEffect, useState } from 'react';
import { getZoneRecords } from '../../services/analyticsApi.js';

export default function DrillDownDrawer({ zone, onClose }) {
  const [records, setRecords] = useState([]);
  useEffect(() => { getZoneRecords(zone).then(setRecords); }, [zone]);
  return (
    <div className="drawer">
      <h3>{zone} — underlying records</h3>
      <table><thead><tr><th>ID</th><th>Type</th><th>Date</th><th>Patrol</th></tr></thead>
      <tbody>{records.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.type}</td><td>{r.date}</td><td>{r.patrol}</td></tr>)}</tbody></table>
      <div className="btnrow"><button className="btn" onClick={onClose}>Close</button></div>
    </div>
  );
}
