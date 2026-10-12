const AnalyticsReport = require('../models/AnalyticsReport');
const ConflictReport = require('../models/ConflictReport');
const AuditEntry = require('../models/AuditEntry');
const { generateAnalytics, noData } = require('../services/analyticsService');
const { findSectorByCode, normalizeSectorCode } = require('../config/areas');

function ownFilter(req, extra = {}) {
  return req.user ? { ...extra, createdBy: req.user.id } : extra;
}

async function generate(req, res, next) {
  try { res.status(201).json(await generateAnalytics(req.body, req.user?.id || null)); } catch (e) { next(e); }
}
async function list(req, res, next) {
  try { res.json(await AnalyticsReport.find(ownFilter(req)).sort({ generatedAt: -1 }).lean()); } catch (e) { next(e); }
}
async function get(req, res, next) {
  try {
    const report = await AnalyticsReport.findOne(ownFilter(req, { reportId: req.params.id })).lean();
    if (!report) return res.status(404).json({ message: 'Analytics report not found' });
    res.json(report);
  } catch (e) { next(e); }
}
function csv(report) {
  const rows = [['Report ID', report.reportId], ['Report type', report.reportType || report.criteria?.reportType || 'overview'],
    ['Status', report.status], ['Incident count', report.summary?.incidentCount || 0], ['Patrol count', report.summary?.patrolCount || 0],
    ['Period days', report.summary?.periodDays || 0]];
  rows.push(['Sector', 'Incident density', 'Patrol hours', 'Required hours', 'Coverage %']);
  Object.entries(report.patrolCoverage || {}).forEach(([z, c]) => rows.push([z, report.incidentDensity?.[z] || 0, c.actualHours, c.requiredHours, c.coveragePercent ?? '']));
  rows.push([], ['Trends'], ['Period', 'Incidents']);
  Object.entries(report.weeklyTrends || {}).forEach(([period, count]) => rows.push([period, count]));
  rows.push([], ['Category trends']);
  Object.entries(report.categoryTrends || {}).forEach(([category, periods]) => Object.entries(periods).forEach(([period, count]) => rows.push([category, period, count])));
  rows.push([], ['Comparison']);
  Object.entries(report.comparison || {}).forEach(([metric, value]) => rows.push([metric, JSON.stringify(value)]));
  rows.push([], ['Recommendations']);
  (report.recommendations || []).forEach((recommendation) => rows.push([recommendation]));
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
function pdf(report) {
  const lines = [
    `Analytics report ${report.reportId}`, `Type: ${report.reportType || report.criteria?.reportType || 'overview'}`,
    `Status: ${report.status}`, `Summary: ${JSON.stringify(report.summary || {})}`,
    `Zones: ${JSON.stringify(report.patrolCoverage || {})}`, `Trends: ${JSON.stringify(report.terrainTrend || report.weeklyTrends || {})}`,
    `Comparison: ${JSON.stringify(report.comparison || {})}`, `Recommendations: ${(report.recommendations || []).join('; ')}`
  ];
  const commands = lines.map((line, index) => `BT /F1 10 Tf 50 ${750 - index * 16} Td (${String(line).replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n');
  const stream = commands;
  return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>/Contents 4 0 R>>endobj\n4 0 obj<</Length ${Buffer.byteLength(stream)}>>stream\n${stream}\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF`);
}
async function exportReport(req, res, next) {
  try {
    const report = await AnalyticsReport.findOne(ownFilter(req, { reportId: req.params.id })).lean();
    if (!report) return res.status(404).json({ message: 'Analytics report not found' });
    const format = String(req.query.format || '').toLowerCase();
    if (!['csv', 'pdf'].includes(format)) return res.status(400).json({ message: 'format must be csv or pdf' });
    await AuditEntry.create({ auditId: `AN-EXPORT-${Date.now()}`, action: 'ANALYTICS_REPORT_EXPORTED', actor: String(req.user?.id || 'demo-manager'), detail: `${report.reportId}:${format}` });
    if (format === 'csv') { res.type('text/csv').attachment(`${report.reportId}.csv`).send(csv(report)); }
    else { res.type('application/pdf').attachment(`${report.reportId}.pdf`).send(pdf(report)); }
  } catch (e) { next(e); }
}
async function zoneRecords(req, res, next) {
  try {
    const sector = findSectorByCode(req.params.code);
    if (!sector) return res.status(400).json({ message: 'Unknown terrain zone' });
    const start = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
    const end = req.query.endDate ? new Date(req.query.endDate) : new Date();
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) return res.status(400).json({ message: 'Invalid date range' });
    const incidentRecords = await ConflictReport.find({ createdAt: { $gte: start, $lt: new Date(end.getTime() + 86400000) } }).lean();
    const patrolRecords = await require('../models/PatrolRecord').find({
      $or: [
        { startedAt: { $lt: new Date(end.getTime() + 86400000), $gte: start } },
        { patrolDate: { $gte: start, $lt: new Date(end.getTime() + 86400000) } },
        { date: { $gte: start, $lt: new Date(end.getTime() + 86400000) } }
      ]
    }).lean();
    const records = incidentRecords.filter((r) => r.location?.coordinates).map((r) => {
      const raw = String(r.incidentType || '').toLowerCase();
      return {
        ...r,
        type: raw.includes('crop') ? 'crop'
          : raw.includes('poach') ? 'poacher'
            : raw.includes('snare') || raw.includes('trap') ? 'snare'
              : 'elephant'
      };
    });
    const filtered = records.filter((r) => r.location?.coordinates && normalizeSectorCode(require('../services/analyticsService').sectorForIncident(r)) === sector.code);
    const patrols = patrolRecords.filter((r) => {
      const code = normalizeSectorCode(r.sector || r.sectorCode || r.terrainZone);
      return code === sector.code || (r.location?.coordinates &&
        normalizeSectorCode(require('../config/areas').findNearestSector(...r.location.coordinates)?.code) === sector.code);
    });
    if (!filtered.length && !patrols.length) throw noData('No records found for this terrain zone');
    res.json({ incidents: filtered, patrols });
  } catch (e) { next(e); }
}
module.exports = { generate, list, get, exportReport, zoneRecords };
