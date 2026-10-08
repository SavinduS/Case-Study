import { mockGenerateReport, mockZoneRecords } from './mockAnalytics.js';

// Same interface the real backend will expose later:
// POST /api/analytics/generate, GET /api/analytics/reports/:id/export?format=
export async function generateReport(criteria) { return mockGenerateReport(criteria); }
export async function getZoneRecords(zone) { return mockZoneRecords(zone); }

export function downloadCSV(report) {
  const rows = [['Zone','Patrols','Coverage','Incidents','Density','Status'],
    ...report.perZone.map((z) => [z.zone, z.patrols, z.coverage, z.incidents, z.density, z.status])];
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${report.id}.csv`; a.click();
}

export function exportPDF(report) {
  // Client-side MVP: print view. Real pdfkit rendering moves to backend later.
  window.print();
}
