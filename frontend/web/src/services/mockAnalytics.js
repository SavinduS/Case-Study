// Mock data matching doc p.22/26: 148 incidents, 612 patrols, 73% avg
export const ZONES = ['Sector 7', 'Riverbank', 'Highland', 'Farmland buffer'];
export const CATEGORIES = ['elephant', 'crop', 'poacher', 'snare'];

const BASE = {
  id: 'R-2201',
  title: 'Patrol analytics, 1-30 June 2023',
  status: 'complete',
  summary: { incidents: 148, patrols: 612, avgCoverage: 73, deltaIncidents: 12, deltaPatrols: 4 },
  perZone: [
    { zone: 'Highland', patrols: 207, coverage: 88, incidents: 19, density: 0.9, status: 'On target' },
    { zone: 'Sector 7', patrols: 184, coverage: 72, incidents: 61, density: 4.1, status: 'Watch' },
    { zone: 'Riverbank', patrols: 139, coverage: 54, incidents: 32, density: 2.3, status: 'Under-patrolled' },
    { zone: 'Farmland buffer', patrols: 82, coverage: 41, incidents: 36, density: 5.6, status: 'Under-patrolled' }
  ],
  weekly: [
    { w: 'W1', count: 22 }, { w: 'W2', count: 28 }, { w: 'W3', count: 26 },
    { w: 'W4', count: 38, peak: true }, { w: 'W5', count: 34 }
  ]
};

export function validateCriteria(c) {
  const errors = {};
  if (!c.from || !c.to) errors.dates = 'Reporting period required';
  if (c.from && c.to && c.from > c.to) errors.dates = 'Invalid date range';
  if (!c.zones || c.zones.length === 0) errors.zones = 'Select at least one terrain zone';
  return errors;
}

export async function mockGenerateReport(criteria) {
  await new Promise((r) => setTimeout(r, 400));
  if (!criteria.zones || criteria.zones.length === 0) {
    const e = new Error('No data'); e.code = 'NO_DATA'; throw e;
  }
  const filtered = { ...BASE, perZone: BASE.perZone.filter((z) => criteria.zones.includes(z.zone)) };
  if (filtered.perZone.length === 0) { const e = new Error('No data'); e.code = 'NO_DATA'; throw e; }
  // simulate partial when Farmland buffer selected alone (incomplete patrols per doc alt-flow 4)
  if (criteria.zones.length === 1 && criteria.zones[0] === 'Farmland buffer') filtered.status = 'partial';
  if (criteria.baseline) {
    filtered.compare = { baseline: 'May 2023', rows: filtered.perZone.map((z) => ({ ...z, prev: Math.max(0, z.incidents - 5) })) };
  }
  return filtered;
}

export function mockZoneRecords(zone) {
  return [
    { id: `${zone}-INC-01`, type: 'elephant', date: '2023-06-12', patrol: '612-A' },
    { id: `${zone}-INC-02`, type: 'snare', date: '2023-06-18', patrol: '612-B' }
  ];
}
