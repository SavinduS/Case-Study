import { useState } from 'react';
import { downloadCSV, exportPDF } from '../../services/analyticsApi.js';

export default function ExportButtons({ report }) {
  const [err, setErr] = useState('');
  function csv() { try { downloadCSV(report); } catch { setErr('Report export failed. Retry export.'); } }
  function pdf() { try { exportPDF(report); } catch { setErr('Report export failed. Retry export.'); } }
  return (
    <span style={{display:'inline-flex',gap:8}}>
      <button className="btn primary" onClick={csv}>Export CSV</button>
      <button className="btn primary" onClick={pdf}>Export PDF</button>
      {err && <span className="err">{err}</span>}
    </span>
  );
}
