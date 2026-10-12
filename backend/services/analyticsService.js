const ConflictReport = require('../models/ConflictReport');
const PatrolRecord = require('../models/PatrolRecord');
const AnalyticsReport = require('../models/AnalyticsReport');
const AuditEntry = require('../models/AuditEntry');
const { nextSequence } = require('../models/Counter');
const { SECTORS, normalizeSectorCode, findNearestSector } = require('../config/areas');

const incidentCategories = ['elephant', 'crop', 'poacher', 'snare'];
const day = 86400000;

function toAnalyticsIncident(report) {
  const raw = String(report.incidentType || report.type || '').toLowerCase();
  const type = raw.includes('crop') ? 'crop'
    : raw.includes('poach') ? 'poacher'
      : raw.includes('snare') || raw.includes('trap') ? 'snare'
        : 'elephant';
  return { ...report, type };
}

function invalid(message) { const e = new Error(message); e.statusCode = 400; return e; }
function noData(message) { const e = new Error(message); e.statusCode = 422; return e; }

function parseCriteria(input = {}) {
  if (input.criteria && typeof input.criteria === 'object') input = input.criteria;
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (!input.startDate || !input.endDate || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    throw invalid('startDate and endDate are required and must be valid dates');
  }
  start.setUTCHours(0, 0, 0, 0); end.setUTCHours(0, 0, 0, 0);
  if (end < start) throw invalid('endDate must be on or after startDate');
  const hasZones = Object.prototype.hasOwnProperty.call(input, 'zones') ||
    Object.prototype.hasOwnProperty.call(input, 'terrainZones');
  const zones = input.zones ?? input.terrainZones ?? [];
  if (hasZones && (!Array.isArray(zones) || zones.length === 0)) throw invalid('at least one terrain zone must be selected');
  const categories = input.categories || [];
  if (!Array.isArray(zones) || zones.some((z) => !SECTORS.some((s) => s.code === normalizeSectorCode(z)))) {
    throw invalid('zones must contain configured sector codes');
  }
  if (!Array.isArray(categories) || categories.some((c) => !incidentCategories.includes(c))) {
    throw invalid(`categories must contain only: ${incidentCategories.join(', ')}`);
  }
  const baseline = input.baseline;
  if (baseline !== undefined && baseline !== null && baseline !== false) {
    if (typeof baseline === 'number' && (!Number.isFinite(baseline) || baseline <= 0)) throw invalid('baseline must be positive');
    if (typeof baseline === 'object' && (!baseline.startDate || !baseline.endDate)) throw invalid('baseline requires startDate and endDate');
    if (typeof baseline === 'object') {
      const bs = new Date(baseline.startDate); const be = new Date(baseline.endDate);
      if (Number.isNaN(bs.valueOf()) || Number.isNaN(be.valueOf()) || be < bs) throw invalid('baseline dates must be valid and ordered');
    }
  }
  const reportTypes = ['overview', 'patrolCoverage', 'incidentSummary', 'terrainTrend'];
  if (!reportTypes.includes(input.reportType || 'overview')) throw invalid(`reportType must be one of: ${reportTypes.join(', ')}`);
  return {
    startDate: start, endDate: end, endExclusive: new Date(end.getTime() + day),
    zones: zones.map(normalizeSectorCode), categories,
    baseline: baseline || null,
    reportType: input.reportType || 'overview'
  };
}

function sectorForIncident(incident) {
  const coords = incident.location && incident.location.coordinates;
  return coords && coords.length >= 2 ? findNearestSector(coords[0], coords[1]).code : null;
}

function isoWeek(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return `${d.getFullYear()}-W${String(1 + Math.round(((d - week1) / day - 3 + ((week1.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
}

function configuredHours() {
  try {
    const value = process.env.REQUIRED_SECTOR_HOURS;
    if (value) return { ...Object.fromEntries(SECTORS.map((s) => [s.code, 0])), ...JSON.parse(value) };
  } catch { /* use defaults */ }
  return Object.fromEntries(SECTORS.map((s) => [s.code, Number(process.env[`REQUIRED_HOURS_${s.code}`] || 0)]));
}

function dateKey(date) { return new Date(date).toISOString().slice(0, 10); }

function periodBounds(criteria) {
  if (typeof criteria.baseline === 'object') {
    const start = new Date(criteria.baseline.startDate); const end = new Date(criteria.baseline.endDate);
    start.setUTCHours(0, 0, 0, 0); end.setUTCHours(0, 0, 0, 0);
    return { start, endExclusive: new Date(end.valueOf() + day) };
  }
  if (criteria.baseline === 'previous-year') {
    const start = new Date(criteria.startDate);
    const endExclusive = new Date(criteria.endExclusive);
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    endExclusive.setUTCFullYear(endExclusive.getUTCFullYear() - 1);
    return { start, endExclusive };
  }
  const length = typeof criteria.baseline === 'number'
    ? criteria.baseline * day
    : criteria.endExclusive - criteria.startDate;
  const endExclusive = new Date(criteria.startDate.valueOf());
  const start = new Date(criteria.startDate.valueOf() - length);
  return { start, endExclusive };
}

function aggregate(incidents, patrols, zones, start, endExclusive) {
  const counts = Object.fromEntries(zones.map((z) => [z, 0]));
  const hours = Object.fromEntries(zones.map((z) => [z, 0]));
  const weekly = {}; const categoryTrends = {};
  incidents.forEach((i) => {
    const zone = sectorForIncident(i);
    if (!zone || !zones.includes(zone)) return;
    counts[zone] += 1;
    const week = isoWeek(i.createdAt); weekly[week] = (weekly[week] || 0) + 1;
    const category = i.type || 'unknown';
    categoryTrends[category] = categoryTrends[category] || {};
    categoryTrends[category][week] = (categoryTrends[category][week] || 0) + 1;
  });
  patrols.forEach((p) => {
    let zone = normalizeSectorCode(p.sector || p.sectorCode || p.terrainZone);
    if (!zones.includes(zone) && p.location?.coordinates?.length >= 2) zone = findNearestSector(...p.location.coordinates).code;
    if (!zones.includes(zone)) return;
    const startAt = new Date(p.startedAt || p.patrolDate || p.date);
    const endAt = new Date(p.endedAt || (startAt.valueOf() + Number(p.durationHours || p.hours || 0) * 3600000));
    const overlapStart = Math.max(start.valueOf(), startAt.valueOf());
    const overlapEnd = Math.min(endExclusive.valueOf(), endAt.valueOf());
    hours[zone] += Math.max(0, (overlapEnd - overlapStart) / 3600000);
  });
  return { counts, hours, weekly, categoryTrends };
}

function variance(current, baseline) {
  const delta = current - baseline;
  return { current, baseline, variance: Number(delta.toFixed(2)),
    variancePercent: baseline ? Number(((delta / baseline) * 100).toFixed(2)) : null };
}

function direction(values) {
  if (values.length < 2) return 'stable';
  return values[values.length - 1] > values[0] ? 'increasing' : values[values.length - 1] < values[0] ? 'decreasing' : 'stable';
}

function reportName(criteria) {
  const labels = {
    overview: 'Park analytics overview',
    patrolCoverage: 'Patrol coverage report',
    incidentSummary: 'Incident summary report',
    terrainTrend: 'Terrain trend report'
  };
  const from = criteria.startDate.toISOString().slice(0, 10);
  const to = criteria.endDate.toISOString().slice(0, 10);
  return `${labels[criteria.reportType] || 'Park analytics report'} · ${from} to ${to}`;
}

async function generateAnalytics(rawCriteria, userId) {
  const criteria = parseCriteria(rawCriteria);
  const incidentQuery = { createdAt: { $gte: criteria.startDate, $lt: criteria.endExclusive } };
  const patrolQuery = { $or: [
    { startedAt: { $lt: criteria.endExclusive }, endedAt: { $gte: criteria.startDate } },
    { patrolDate: { $gte: criteria.startDate, $lt: criteria.endExclusive } },
    { date: { $gte: criteria.startDate, $lt: criteria.endExclusive } }
  ] };
  const [incidentReports, patrols] = await Promise.all([ConflictReport.find(incidentQuery).lean(), PatrolRecord.find(patrolQuery).lean()]);
  const incidents = incidentReports.map(toAnalyticsIncident)
    .filter((incident) => !criteria.categories.length || criteria.categories.includes(incident.type));
  if (!incidents.length && !patrols.length) throw noData('No incident or patrol data exists for the selected period');
  const zones = criteria.zones.length ? criteria.zones : SECTORS.map((s) => s.code);
  const current = aggregate(incidents, patrols, zones, criteria.startDate, criteria.endExclusive);
  const counts = current.counts; const hours = current.hours; const weekly = current.weekly;
  const required = configuredHours();
  const coverage = zones.map((z) => ({
    [z]: { requiredHours: Number(required[z] || 0), actualHours: Number(hours[z].toFixed(2)),
      coveragePercent: required[z] ? Number(Math.min(100, (hours[z] / required[z]) * 100).toFixed(2)) : null }
  })).reduce((a, x) => Object.assign(a, x), {});
  const partialReasons = [];
  if (!patrols.length) partialReasons.push('No patrol records were available for the selected period');
  if (!incidents.length) partialReasons.push('No incident records were available for the selected period');
  const reportingDays = Math.ceil((criteria.endExclusive - criteria.startDate) / day);
  const coveredDaysByZone = Object.fromEntries(zones.map((z) => [z, new Set()]));
  patrols.forEach((p) => {
    let zone = normalizeSectorCode(p.sector || p.sectorCode || p.terrainZone);
    if (!zones.includes(zone) && p.location?.coordinates?.length >= 2) zone = findNearestSector(...p.location.coordinates).code;
    if (!coveredDaysByZone[zone]) return;
    const from = new Date(p.startedAt || p.patrolDate || p.date);
    const to = new Date(p.endedAt || from);
    for (let d = new Date(Math.max(from, criteria.startDate)); d < Math.min(to, criteria.endExclusive); d = new Date(d.valueOf() + day)) coveredDaysByZone[zone].add(dateKey(d));
  });
  const missingByZone = zones.map((z) => {
    const missing = reportingDays - coveredDaysByZone[z].size;
    return missing > 0 ? `${z}: ${missing} day(s)` : null;
  }).filter(Boolean);
  if (missingByZone.length) partialReasons.push(`Patrol coverage gaps within the selected period (${missingByZone.join(', ')})`);
  let comparison = null;
  if (criteria.baseline) {
    const bounds = periodBounds(criteria);
    const bIncidentQuery = { createdAt: { $gte: bounds.start, $lt: bounds.endExclusive } };
    const bPatrolQuery = { $or: [{ startedAt: { $lt: bounds.endExclusive }, endedAt: { $gte: bounds.start } }, { patrolDate: { $gte: bounds.start, $lt: bounds.endExclusive } }, { date: { $gte: bounds.start, $lt: bounds.endExclusive } }] };
    const [bIncidentReports, bPatrols] = await Promise.all([ConflictReport.find(bIncidentQuery).lean(), PatrolRecord.find(bPatrolQuery).lean()]);
    const bIncidents = bIncidentReports.map(toAnalyticsIncident)
      .filter((incident) => !criteria.categories.length || criteria.categories.includes(incident.type));
    const base = aggregate(bIncidents, bPatrols, zones, bounds.start, bounds.endExclusive);
    comparison = { incidentCount: variance(incidents.length, bIncidents.length), patrolCount: variance(patrols.length, bPatrols.length),
      incidentDensity: Object.fromEntries(zones.map((z) => [z, variance(counts[z], base.counts[z])])),
      patrolHours: Object.fromEntries(zones.map((z) => [z, variance(hours[z], base.hours[z])])) };
  }
  const trendValues = Object.values(weekly);
  const trendLabel = direction(trendValues);
  const categoryDirections = Object.fromEntries(Object.entries(current.categoryTrends).map(([category, periods]) => [category, direction(Object.values(periods))]));
  const recommendations = zones.filter((z) => coverage[z].requiredHours && coverage[z].actualHours < coverage[z].requiredHours)
    .map((z) => `Increase patrol coverage in ${z} to meet the configured ${coverage[z].requiredHours} hour requirement`);
  const highest = zones.reduce((a, z) => counts[z] > (counts[a] || -1) ? z : a, zones[0]);
  if (highest && counts[highest] > 0) recommendations.push(`Prioritize ranger deployments in ${highest}, which has the highest incident count (${counts[highest]})`);
  if (trendLabel === 'increasing') recommendations.push('Incident activity is increasing; review hotspot patrol routes and increase preventive patrols.');
  const year = new Date().getUTCFullYear();
  const seq = await nextSequence(`analytics-report-${year}`);
  const report = await AnalyticsReport.create({
    reportId: `AN-${year}-${String(seq).padStart(6, '0')}`, createdBy: userId || null, criteria: {
      startDate: criteria.startDate, endDate: criteria.endDate, zones, categories: criteria.categories,
      baseline: criteria.baseline, reportType: criteria.reportType
    }, name: reportName(criteria), status: partialReasons.length ? 'partial' : 'complete', partialReasons,
    summary: { incidentCount: incidents.length, patrolCount: patrols.length, periodDays: reportingDays },
    incidentDensity: counts, patrolCoverage: coverage, weeklyTrends: weekly,
    categoryTrends: current.categoryTrends, categoryTrendDirections: categoryDirections,
    terrainTrend: { periods: weekly, direction: trendLabel, categoryDirections },
    comparison, reportType: criteria.reportType, recommendations,
    output: criteria.reportType === 'patrolCoverage'
      ? { patrolCoverage: coverage, gaps: partialReasons.filter((r) => r.toLowerCase().includes('patrol')) }
      : criteria.reportType === 'incidentSummary'
        ? { incidentDensity: counts, categoryTrends: current.categoryTrends, comparison }
        : criteria.reportType === 'terrainTrend'
          ? { terrainTrend: { periods: weekly, direction: trendLabel, categoryTrends: current.categoryTrends, categoryDirections } }
          : { summary: { incidentCount: incidents.length, patrolCount: patrols.length }, patrolCoverage: coverage, incidentDensity: counts, terrainTrend: { periods: weekly, direction: trendLabel }, comparison, recommendations }
  });
  await AuditEntry.create({ auditId: `AN-${seq}-${Date.now()}`, action: 'ANALYTICS_REPORT_GENERATED', actor: String(userId || 'demo-manager'), detail: report.reportId });
  return report;
}

module.exports = { parseCriteria, generateAnalytics, incidentCategories, sectorForIncident, noData };
