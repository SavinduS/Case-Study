const { upload } = require('../utils/upload');
const FieldIncident = require('../models/FieldIncident');
const service = require('../services/fieldIncidentService');

// Thin HTTP layer for Log Field Incident Offline (IncidentController):
// parse request -> call fieldIncidentService -> map to status code.
// Idempotency, validation mapping, displayId generation, persistence and
// photo cleanup all live in services/fieldIncidentService.js; documents
// live in models/FieldIncident.js (IncidentDB).

// POST /api/field-incidents — single ranger report (JSON or multipart with
// optional `photo` file). Requires authentication (wired in routes).
function createFieldIncident(req, res, next) {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Photo exceeds the 5 MB limit' });
      }
      if (err.code === 'UNSUPPORTED_TYPE') {
        return res.status(415).json({ message: 'Only JPEG or PNG photos are supported' });
      }
      return next(err);
    }
    try {
      const file = req.file
        ? { path: `/uploads/${req.file.filename}`, mimetype: req.file.mimetype, size: req.file.size }
        : null;
      const result = await service.registerFieldIncident({
        body: req.body || {},
        file,
        reporter: req.user?.id || null,
        uploadedPath: req.file?.path ?? null
      });
      res.status(result.status).json(result.payload);
    } catch (e) {
      next(e);
    }
  });
}

// POST /api/field-incidents/sync — bulk offline upload, idempotent per
// reportId. Individual item failures never abort the batch.
async function syncFieldIncidents(req, res, next) {
  try {
    const reports = req.body && Array.isArray(req.body.reports) ? req.body.reports : null;
    if (!reports) return res.status(400).json({ message: 'Body must be { reports: [...] }' });
    if (reports.length > service.SYNC_BATCH_LIMIT) {
      return res.status(400).json({ message: `Too many reports (max ${service.SYNC_BATCH_LIMIT} per sync)` });
    }
    const results = await service.syncReports(reports, req.user?.id || null);
    res.json({ synced: results.filter((r) => r.ok).length, results });
  } catch (e) {
    next(e);
  }
}

// GET /api/field-incidents/mine — this reporter's incidents, newest first.
async function myFieldIncidents(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const reports = await FieldIncident.find({ reporter: req.user?.id })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ count: reports.length, reports: reports.map(service.toPublicReport) });
  } catch (e) {
    next(e);
  }
}

// GET /api/field-incidents/:reportId — single report lookup.
async function getFieldIncident(req, res, next) {
  try {
    const report = await FieldIncident.findOne({ reportId: req.params.reportId });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(service.toPublicReport(report));
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createFieldIncident,
  syncFieldIncidents,
  myFieldIncidents,
  getFieldIncident,
  // Re-exported for existing callers/tests; canonical home is the service.
  registerFieldIncident: service.registerFieldIncident,
  toPublicReport: service.toPublicReport
};
