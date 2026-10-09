import { useEffect, useState } from 'react';
import { ComparisonPanel } from './ReportsPage.jsx';
import { getReport } from '../services/reportsApi.js';

const criteria = {
  reportType: 'incident',
  startDate: '2026-01-01',
  endDate: '2026-10-09',
  zones: ['NORTHBOUNDARY', 'EASTBOUNDARY', 'SOUTHBOUNDARY', 'WESTBOUNDARY'],
  categories: ['elephant', 'crop', 'poacher', 'snare'],
  baseline: 'previous-period'
};

export default function ComparisonPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getReport(criteria).then(setReport).catch((e) => setError(e.message));
  }, []);

  return <div className="h-full overflow-auto bg-sand-100 p-4 sm:p-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-moss-500">Park manager workspace</p>
        <h1 className="mt-1 text-2xl font-extrabold text-park-900">Comparison with baseline</h1>
        <p className="mt-1 text-sm text-stone-500">Compare live incident and patrol activity with the previous reporting period.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-alert-100 p-4 text-sm text-alert-600">{error}</p>}
      {!report && !error && <div className="rounded-xl bg-white p-8 text-center text-sm text-stone-500">Loading baseline comparison…</div>}
      {report && <ComparisonPanel comparison={report.comparison} />}
    </div>
  </div>;
}
