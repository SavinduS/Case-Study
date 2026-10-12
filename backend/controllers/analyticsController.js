const AnalyticsReport = require('../models/AnalyticsReport');
const ConflictReport = require('../models/ConflictReport');
const AuditEntry = require('../models/AuditEntry');
const PDFDocument = require('pdfkit');
const { generateAnalytics, noData, getRequiredHours, DEFAULT_REQUIRED_HOURS } = require('../services/analyticsService');
const { findSectorByCode, normalizeSectorCode, SECTORS } = require('../config/areas');
const ZoneSetting = require('../models/ZoneSetting');

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
async function getZoneSettings(req, res, next) {
  try {
    const docs = await ZoneSetting.find({}).lean();
    const byCode = Object.fromEntries(docs.map((d) => [normalizeSectorCode(d.code), d]));
    const required = await getRequiredHours();
    res.json(SECTORS.map((s) => ({
      code: s.code,
      name: s.name,
      requiredHours: required[s.code] ?? DEFAULT_REQUIRED_HOURS,
      saved: Boolean(byCode[s.code])
    })));
  } catch (e) { next(e); }
}
async function updateZoneSettings(req, res, next) {
  try {
    const rows = req.body?.settings;
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ message: 'settings must be a non-empty array' });
    const ops = rows.map((row) => {
      const sector = findSectorByCode(row?.code);
      const hours = Number(row?.requiredHours);
      if (!sector) throw Object.assign(new Error(`Unknown terrain zone: ${row?.code}`), { statusCode: 400 });
      if (!Number.isFinite(hours) || hours < 0 || hours > 10000) {
        throw Object.assign(new Error(`requiredHours for ${sector.code} must be a number between 0 and 10000`), { statusCode: 400 });
      }
      return {
        updateOne: {
          filter: { code: sector.code },
          update: { $set: { name: sector.name, requiredHours: hours, updatedBy: req.user?.id || null } },
          upsert: true
        }
      };
    });
    await ZoneSetting.bulkWrite(ops);
    await AuditEntry.create({ auditId: `AN-ZONES-${Date.now()}`, action: 'ANALYTICS_ZONE_SETTINGS_UPDATED', actor: String(req.user?.id || 'demo-manager'), detail: rows.map((r) => `${normalizeSectorCode(r.code)}:${r.requiredHours}`).join(',') });
    res.json({ updated: ops.length });
  } catch (e) { next(e); }
}
const ZONE_NAMES = { NORTHBOUNDARY: 'North Boundary', EASTBOUNDARY: 'East Boundary', SOUTHBOUNDARY: 'South Boundary', WESTBOUNDARY: 'West Boundary' };
const TYPE_NAMES = { overview: 'Park analytics overview', patrolCoverage: 'Patrol coverage report', incidentSummary: 'Incident summary report', terrainTrend: 'Terrain trend report', incident: 'Incident summary report', patrol: 'Patrol coverage report', terrain: 'Terrain trend report' };
function prettyZone(code) { return ZONE_NAMES[String(code || '').toUpperCase()] || String(code || ''); }
function prettyType(report) { return TYPE_NAMES[report.reportType || report.criteria?.reportType || 'overview'] || 'Park analytics report'; }
function fmtDate(v) { try { return v ? new Date(v).toISOString().slice(0, 10) : ''; } catch { return ''; } }
function fmtNum(v) { if (v == null || v === '') return '-'; const n = Number(v); return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(v); }
function toAscii(s) { return String(s ?? '').replace(/[^\x20-\x7E]/g, (ch) => ({ '·': '-', '—': '-', '–': '-', '°': 'deg', '✓': 'v', '⚠': '!' }[ch] || '')); }

function csv(report) {
  const crit = report.criteria || {};
  const rows = [
    ['Serengeti Portal - Park Management Analytics'],
    ['Report', report.name || report.reportId],
    ['Report ID', report.reportId],
    ['Report type', prettyType(report)],
    ['Status', `${report.status || 'complete'}${(report.partialReasons || []).length ? ` - ${(report.partialReasons || []).join(' ')}` : ''}`],
    ['Generated at', fmtDate(report.generatedAt || report.createdAt || Date.now())],
    ['Period', `${fmtDate(crit.startDate)} to ${fmtDate(crit.endDate)}`],
    ['Zones', (crit.zones || []).map(prettyZone).join('; ') || 'All zones'],
    ['Categories', (crit.categories || []).join(', ') || 'All categories'],
    ['Baseline', crit.baseline && typeof crit.baseline === 'object' ? `${fmtDate(crit.baseline.startDate)} to ${fmtDate(crit.baseline.endDate)}` : (crit.baseline || 'none')],
    [],
    ['SUMMARY'],
    ['Incidents recorded', report.summary?.incidentCount || 0],
    ['Patrol records', report.summary?.patrolCount || 0],
    ['Period days', report.summary?.periodDays || 0],
    [],
    ['ZONE BREAKDOWN'],
    ['Zone', 'Incidents', 'Patrol hours', 'Required hours', 'Coverage %'],
  ];
  Object.entries(report.patrolCoverage || {}).forEach(([z, c]) => rows.push([
    prettyZone(z), report.incidentDensity?.[z] ?? 0, fmtNum(c.actualHours), fmtNum(c.requiredHours), c.coveragePercent ?? '-',
  ]));
  rows.push([], ['WEEKLY TREND'], ['Period', 'Incidents']);
  Object.entries(report.weeklyTrends || {}).sort().forEach(([period, count]) => rows.push([period, count]));
  rows.push([], ['CATEGORY TREND'], ['Category', 'Period', 'Incidents']);
  Object.entries(report.categoryTrends || {}).forEach(([category, periods]) => Object.entries(periods || {}).sort().forEach(([period, count]) => rows.push([category, period, count])));
  rows.push([], ['COMPARISON WITH BASELINE'], ['Metric', 'Current', 'Baseline', 'Change', 'Change %']);
  Object.entries(report.comparison || {}).forEach(([metric, value]) => {
    if (value && typeof value === 'object' && ('current' in value)) {
      rows.push([metric, fmtNum(value.current), fmtNum(value.baseline), fmtNum(value.variance ?? value.change), value.variancePercent ?? '-']);
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([zone, m]) => rows.push([`${metric} - ${prettyZone(zone)}`, fmtNum(m?.current), fmtNum(m?.baseline), fmtNum(m?.variance ?? m?.change), m?.variancePercent ?? '-']));
    }
  });
  rows.push([], ['RECOMMENDATIONS']);
  (report.recommendations || []).forEach((r, i) => rows.push([`${i + 1}. ${r}`]));
  if (!(report.recommendations || []).length) rows.push(['No recommendations for this period.']);
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

// --- Styled multi-page PDF via pdfkit: header band, KPI cards, real tables ---
const PDF_INK = '#123a2d';
const PDF_MOSS = '#2e7d4f';
const PDF_MUTED = '#78716c';
const PDF_ALERT = '#b3402a';
const PDF_GOLD_BG = '#fdf3d7';
const PDF_SAND_BG = '#f5f1e6';
const PDF_TABLE_HEAD_BG = '#123a2d';
const PDF_ROW_ALT_BG = '#f7f5ec';
const PDF_METRIC_LABELS = { incidentCount: 'Incident count', patrolCount: 'Patrol records', incidentDensity: 'Incident density by zone', patrolHours: 'Patrol hours by zone' };

function pdfBuffer(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 52, left: 48, right: 48 }, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const ml = doc.page.margins.left;
    const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const need = (h) => { if (doc.y + h > bottom()) doc.addPage(); };
    const clean = (s) => toAscii(s);
    const crit = report.criteria || {};
    let section = 0;
    const nextSection = (title) => {
      section += 1;
      need(44);
      doc.moveDown(0.6);
      doc.x = ml;
      doc.font('Helvetica-Bold').fontSize(12).fillColor(PDF_INK).text(`${section}. ${title}`, ml, doc.y, { width: contentW });
      doc.save().strokeColor(PDF_MOSS).lineWidth(1.5)
        .moveTo(ml, doc.y + 2).lineTo(ml + 46, doc.y + 2).stroke().restore();
      doc.moveDown(0.5);
      doc.fillColor('#000000');
    };

    // Header band
    doc.save().fillColor(PDF_INK).rect(0, 0, doc.page.width, 84).fill().restore();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17).text('Serengeti Portal', ml, 20, { width: contentW });
    doc.font('Helvetica').fontSize(10).fillColor('#cfe0d4').text('Park Management Analytics', ml, 42, { width: contentW });
    doc.fillColor('#000000');
    doc.y = 98;

    // Report title
    doc.font('Helvetica-Bold').fontSize(14).fillColor(PDF_INK)
      .text(clean(report.name || `Park analytics report ${report.reportId || ''}`), { width: contentW });
    doc.moveDown(0.4);

    // Meta box
    const base = crit.baseline;
    const baselineText = base && typeof base === 'object'
      ? `${fmtDate(base.startDate)} to ${fmtDate(base.endDate)}`
      : (base || 'none');
    const metaLines = [
      ['Report ID', clean(report.reportId || '-'), 'Type', clean(prettyType(report))],
      ['Status', clean(report.status || 'complete'), 'Generated', fmtDate(report.generatedAt || report.createdAt || Date.now())],
      ['Period', `${fmtDate(crit.startDate)} to ${fmtDate(crit.endDate)}`, 'Baseline', clean(baselineText)],
      ['Zones', clean((crit.zones || []).map(prettyZone).join(', ') || 'All zones'), 'Categories', clean((crit.categories || []).join(', ') || 'All')],
    ];
    need(30 + metaLines.length * 15);
    const metaY = doc.y;
    const metaH = 12 + metaLines.length * 15;
    doc.save().fillColor(PDF_SAND_BG).roundedRect(ml, metaY, contentW, metaH, 6).fill().restore();
    let my = metaY + 8;
    metaLines.forEach(([k1, v1, k2, v2]) => {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_MUTED).text(k1.toUpperCase(), ml + 10, my, { width: 70, continued: false });
      doc.font('Helvetica').fontSize(9).fillColor(PDF_INK).text(v1 || '-', ml + 82, my, { width: contentW / 2 - 92 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_MUTED).text(k2.toUpperCase(), ml + contentW / 2 + 6, my, { width: 70, continued: false });
      doc.font('Helvetica').fontSize(9).fillColor(PDF_INK).text(v2 || '-', ml + contentW / 2 + 78, my, { width: contentW / 2 - 88 });
      my += 15;
    });
    doc.y = metaY + metaH + 10;
    doc.fillColor('#000000');

    // Partial warning
    if ((report.partialReasons || []).length) {
      const warn = `Partial report: ${clean(report.partialReasons.join(' '))}`;
      const wh = doc.heightOfString(warn, { width: contentW - 20 }) + 16;
      need(wh + 8);
      const wy = doc.y;
      doc.save().fillColor(PDF_GOLD_BG).roundedRect(ml, wy, contentW, wh, 6).fill().restore();
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(PDF_INK).text(warn, ml + 10, wy + 8, { width: contentW - 20 });
      doc.y = wy + wh + 8;
      doc.fillColor('#000000');
    }

    // KPI cards
    const kpis = [
      ['Incidents recorded', String(report.summary?.incidentCount ?? 0)],
      ['Patrol records', String(report.summary?.patrolCount ?? 0)],
      ['Period days', String(report.summary?.periodDays ?? 0)],
    ];
    need(64);
    const cardW = (contentW - 16) / 3;
    const cardY = doc.y;
    kpis.forEach(([label, value], i) => {
      const x = ml + i * (cardW + 8);
      doc.save().fillColor('#ffffff').strokeColor('#e3ddc9').lineWidth(1).roundedRect(x, cardY, cardW, 54, 8).fillAndStroke().restore();
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_MUTED).text(label.toUpperCase(), x + 10, cardY + 8, { width: cardW - 20 });
      doc.font('Helvetica-Bold').fontSize(19).fillColor(i === 0 ? PDF_ALERT : PDF_MOSS).text(value, x + 10, cardY + 24, { width: cardW - 20 });
    });
    doc.y = cardY + 62;
    doc.x = ml;
    doc.fillColor('#000000');

    // Generic row-table helper with real column positions
    function drawTable(headers, rows, colWidths) {
      const xs = [];
      let acc = ml;
      colWidths.forEach((w) => { xs.push(acc); acc += w; });
      const headH = 18;
      const drawHead = () => {
        doc.save().fillColor(PDF_TABLE_HEAD_BG).roundedRect(ml, doc.y, contentW, headH, 4).fill().restore();
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
        headers.forEach((h, i) => doc.text(h, xs[i] + 6, doc.y + 5, { width: colWidths[i] - 12 }));
        doc.y += headH + 2;
      };
      need(headH + 20);
      drawHead();
      rows.forEach((cells, ri) => {
        doc.font('Helvetica').fontSize(9);
        const h = Math.max(16, ...cells.map((c, i) => doc.heightOfString(String(c), { width: colWidths[i] - 12 }))) + 8;
        need(h + 2);
        if (ri % 2 === 1) doc.save().fillColor(PDF_ROW_ALT_BG).rect(ml, doc.y, contentW, h).fill().restore();
        const ry = doc.y;
        cells.forEach((c, i) => {
          doc.fillColor(i === 0 ? PDF_INK : '#000000').font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
            .text(String(c), xs[i] + 6, ry + 4, { width: colWidths[i] - 12 });
        });
        doc.y = ry + h;
        doc.fillColor('#000000').font('Helvetica');
      });
      doc.x = ml;
      doc.moveDown(0.4);
    }

    // 1. Summary is covered by KPI cards + meta; start numbered sections at Zone breakdown
    nextSection('Zone breakdown');
    {
      const zw = contentW - 4 * 72;
      const cw = 72;
      const headers = ['Zone', 'Incidents', 'Patrol hrs', 'Required', 'Coverage'];
      const rows = Object.entries(report.patrolCoverage || {}).map(([z, c]) => [
        clean(prettyZone(z)),
        String(report.incidentDensity?.[z] ?? 0),
        fmtNum(c.actualHours),
        fmtNum(c.requiredHours),
        c.coveragePercent == null ? '-' : `${fmtNum(c.coveragePercent)}%`,
      ]);
      if (rows.length) drawTable(headers, rows, [zw, cw, cw, cw, cw]);
      else { doc.x = ml; doc.font('Helvetica').fontSize(9.5).fillColor(PDF_MUTED).text('No zone data for this period.', ml, doc.y, { width: contentW }); doc.x = ml; }
      doc.fillColor('#000000');
    }

    const weeks = Object.entries(report.weeklyTrends || {}).sort();
    if (weeks.length) {
      nextSection('Weekly trend');
      const max = Math.max(...weeks.map(([, n]) => Number(n) || 0), 1);
      weeks.forEach(([p, n]) => {
        need(30);
        const val = Number(n) || 0;
        const ly = doc.y;
        doc.font('Helvetica').fontSize(9).fillColor(PDF_MUTED).text(p, ml, ly, { width: 90 });
        const barX = ml + 96;
        const barW = (contentW - 150) * (val / max);
        doc.save().fillColor('#e9e6da').roundedRect(barX, ly + 2, contentW - 150, 10, 5).fill().restore();
        if (barW > 1) doc.save().fillColor(PDF_MOSS).roundedRect(barX, ly + 2, Math.max(barW, 3), 10, 5).fill().restore();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_INK).text(String(val), ml + contentW - 46, ly, { width: 46, align: 'right' });
        doc.y = ly + 16;
        doc.x = ml;
      });
      doc.fillColor('#000000');
    }

    const cats = Object.entries(report.categoryTrends || {});
    if (cats.length) {
      nextSection('Category trend');
      cats.forEach(([cat, periods]) => {
        const total = Object.values(periods || {}).reduce((s, v) => s + Number(v || 0), 0);
        need(28);
        doc.x = ml;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(PDF_INK)
          .text(`${clean(cat)}: ${total} total`, ml, doc.y, { width: contentW });
        doc.font('Helvetica').fontSize(8.5).fillColor(PDF_MUTED)
          .text(Object.entries(periods || {}).sort().map(([p, n]) => `${p} = ${n}`).join('   '), ml, doc.y, { width: contentW });
        doc.x = ml;
        doc.moveDown(0.35);
      });
      doc.fillColor('#000000');
    }

    if (report.comparison && Object.keys(report.comparison).length) {
      nextSection('Comparison with baseline');
      const changeText = (m) => {
        if (!m || typeof m !== 'object') return '-';
        const ch = fmtNum(m.variance ?? m.change);
        const pct = m.variancePercent != null ? ` (${Number(m.variancePercent) > 0 ? '+' : ''}${m.variancePercent}%)` : '';
        const sign = Number(m.variance ?? m.change) > 0 ? '+' : '';
        return `${sign}${ch}${pct}`;
      };
      const changeColor = (m) => {
        const v = Number(m?.variance ?? m?.change);
        if (!Number.isFinite(v) || v === 0) return PDF_MUTED;
        return v > 0 ? PDF_ALERT : PDF_MOSS;
      };
      Object.entries(report.comparison).forEach(([metric, value]) => {
        const label = PDF_METRIC_LABELS[metric] || clean(metric);
        if (value && typeof value === 'object' && ('current' in value)) {
          need(26);
          doc.x = ml;
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor(PDF_INK).text(label, ml, doc.y, { width: contentW });
          doc.x = ml;
          doc.font('Helvetica').fontSize(9).fillColor('#000000')
            .text(`Current ${fmtNum(value.current)}  vs  baseline ${fmtNum(value.baseline)}  (change `, ml, doc.y, { continued: true, width: contentW });
          doc.font('Helvetica-Bold').fillColor(changeColor(value)).text(`${changeText(value).replace(/^/, '')}`, { continued: true });
          doc.font('Helvetica').fillColor('#000000').text(')');
          doc.x = ml;
          doc.moveDown(0.3);
        } else if (value && typeof value === 'object') {
          need(30);
          doc.x = ml;
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor(PDF_INK).text(`${label} by zone`, ml, doc.y, { width: contentW });
          doc.moveDown(0.2);
          const zw = contentW - 3 * 80;
          const rows = Object.entries(value).map(([zone, m]) => ({ cells: [clean(prettyZone(zone)), fmtNum(m?.current), fmtNum(m?.baseline), changeText(m)], color: changeColor(m) }));
          const xs = [ml, ml + zw, ml + zw + 80, ml + zw + 160];
          const widths = [zw, 80, 80, 80];
          doc.save().fillColor(PDF_TABLE_HEAD_BG).roundedRect(ml, doc.y, contentW, 18, 4).fill().restore();
          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
          ['Zone', 'Current', 'Baseline', 'Change'].forEach((h, i) => doc.text(h, xs[i] + 6, doc.y + 5, { width: widths[i] - 12 }));
          doc.y += 20;
          rows.forEach((r, ri) => {
            doc.font('Helvetica').fontSize(9);
            const h = Math.max(16, ...r.cells.map((c, i) => doc.heightOfString(String(c), { width: widths[i] - 12 }))) + 8;
            need(h + 2);
            if (ri % 2 === 1) doc.save().fillColor(PDF_ROW_ALT_BG).rect(ml, doc.y, contentW, h).fill().restore();
            const ry = doc.y;
            r.cells.forEach((c, i) => {
              const col = i === 3 ? r.color : (i === 0 ? PDF_INK : '#000000');
              doc.fillColor(col).font(i === 0 || i === 3 ? 'Helvetica-Bold' : 'Helvetica')
                .text(String(c), xs[i] + 6, ry + 4, { width: widths[i] - 12 });
            });
            doc.y = ry + h;
          });
          doc.x = ml;
          doc.moveDown(0.4);
          doc.fillColor('#000000').font('Helvetica');
        }
      });
    }

    nextSection('Recommendations');
    if ((report.recommendations || []).length) {
      report.recommendations.forEach((r, i) => {
        need(26);
        const ry = doc.y;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(PDF_MOSS).text(`${i + 1}.`, ml, ry, { width: 20 });
        doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(clean(r), ml + 20, ry, { width: contentW - 20 });
        doc.x = ml;
        doc.moveDown(0.35);
      });
    } else {
      doc.x = ml;
      doc.font('Helvetica').fontSize(9.5).fillColor(PDF_MUTED).text('No recommendations for this period.', ml, doc.y, { width: contentW });
      doc.x = ml;
      doc.fillColor('#000000');
    }

    // Footer page numbers
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor(PDF_MUTED)
        .text(`Page ${i + 1} of ${range.count}  |  ${clean(report.reportId || '')}`, ml, doc.page.height - 34, { width: contentW, align: 'center' });
    }
    doc.end();
  });
}
async function exportReport(req, res, next) {
  try {
    const report = await AnalyticsReport.findOne(ownFilter(req, { reportId: req.params.id })).lean();
    if (!report) return res.status(404).json({ message: 'Analytics report not found' });
    const format = String(req.query.format || '').toLowerCase();
    if (!['csv', 'pdf'].includes(format)) return res.status(400).json({ message: 'format must be csv or pdf' });
    await AuditEntry.create({ auditId: `AN-EXPORT-${Date.now()}`, action: 'ANALYTICS_REPORT_EXPORTED', actor: String(req.user?.id || 'demo-manager'), detail: `${report.reportId}:${format}` });
    if (format === 'csv') { res.type('text/csv').attachment(`${report.reportId}.csv`).send(csv(report)); }
    else { res.type('application/pdf').attachment(`${report.reportId}.pdf`).send(await pdfBuffer(report)); }
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
module.exports = { generate, list, get, exportReport, zoneRecords, getZoneSettings, updateZoneSettings };
