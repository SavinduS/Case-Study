import { useState } from 'react';
import { downloadCSV, exportPDF } from '../../services/analyticsApi.js';

export default function ExportButtons({ report }) {
  const [err, setErr] = useState('');
  return (
    <span className="inline-flex items-center gap-2">
      <button className="rounded-lg bg-park-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-park-800" onClick={() => { try { downloadCSV(report); } catch { setErr('Report export failed. Retry export.'); } }}>Export report</button>
      <button className="rounded-lg px-3 py-2.5 text-sm underline" onClick={() => { try { exportPDF(report); } catch { setErr('Report export failed. Retry export.'); } }}>PDF</button>
      {err && <span className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</span>}
    </span>
  );
}
