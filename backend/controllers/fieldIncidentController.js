const fs = require('fs');
const FieldIncident = require('../models/FieldIncident');
const { validateFieldIncident } = require('../utils/validateFieldIncident');
const { nextFieldIncidentDisplayId } = require('../utils/fieldIncidentDisplayId');
const { upload } = require('../utils/upload');

const SYNC_BATCH_LIMIT = 100;

function toPublicReport(r) {
  if (!r) return r;
  const obj = typeof r.toObject === 'function' ? r.toObject() : r;
  return {
    reportId: obj.reportId,
    displayId: obj.displayId,
    incidentType: obj.incidentType,
    description: obj.description,
    location: obj.location,
    capturedAt: obj.capturedAt,
    receivedAt: obj.receivedAt,
    photo: obj.photo && obj.photo.path ? obj.photo : null,
    reporter: obj.reporter,
    patrolId: obj.patrolId,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
}

// Map validator photo errors to suitable HTTP codes. All other validation
// problems are 400. Multer errors are mapped by the route wrapper below.
function statusForValidationErrors(errors) {
  const photoErrors = errors.filter((e) => e.field === 'photo');
  if (photoErrors.some((e) => /Only JPEG or PNG/.test(e.message))) return 415;
  if (photoErrors.some((e) => /5 MB/.test(e.message))) return 413;
  return 400;
}

function removeUploadedFile(file) {
  if (!file || !file.path) return;
  fs.unlink(file.path, () => {});
}

// Shared core: idempotency (by device reportId) -> validate -> store.
// Returns { status, payload } following the conflict-report registerReport
// convention (201 created, 200 already-synced, 400/413/415 validation).
async function registerFieldIncident({ body = {}, file = null, reporter = null }) {
  const trimmedReportId =
    body.reportId !== undefined && body.reportId !== null
      ? String(body.reportId).trim()
      : '';

  if (trimmedReportId) {
    const existing = await FieldIncident.findOne({ reportId: trimmedReportId });
    if (existing) {
      return { status: 200, payload: { ...toPublicReport(existing), alreadySynced: true } };
    }
  }

  const { ok, errors, value } = validateFieldIncident(body, { file });
  if (!ok) {
    return {
      status: statusForValidationErrors(errors),
      payload: { message: 'Validation failed', errors }
    };
  }

  const displayId = await nextFieldIncidentDisplayId();
  try {
    const report = await FieldIncident.create({
      ...value,
      displayId,
      receivedAt: new Date(),
      reporter: reporter || null
    });
    return { status: 201, payload: toPublicReport(report) };
  } catch (e) {
    // Concurrent retry with the same reportId: first write wins, second
    // returns the stored report instead of duplicating (idempotency).
    if (e && e.code === 11000) {
      const existing = await FieldIncident.findOne({ reportId: value.reportId });
      if (existing) {
        return { status: 200, payload: { ...toPublicReport(existing), alreadySynced: true } };
      }
    }
    throw e;
  }
}

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
      const result = await registerFieldIncident({
        body: req.body || {},
        file,
        reporter: req.user?.id || null
      });
      if (result.status !== 201 && result.status !== 200 && req.file) {
        removeUploadedFile(req.file);
      }
      res.status(result.status).json(result.payload);
    } catch (e) {
      if (req.file) removeUploadedFile(req.file);
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
    if (reports.length > SYNC_BATCH_LIMIT) {
      return res.status(400).json({ message: `Too many reports (max ${SYNC_BATCH_LIMIT} per sync)` });
    }

    const results = [];
    for (const item of reports) {
      if (!item || !item.reportId) {
        results.push({
          reportId: (item && item.reportId) || null,
          ok: false,
          message: 'reportId is required for sync',
          errors: [{ field: 'reportId', message: 'reportId is required' }]
        });
        continue;
      }
      try {
        const result = await registerFieldIncident({
          body: item,
          reporter: req.user?.id || null
        });
        results.push({
          reportId: item.reportId,
          ok: result.status === 200 || result.status === 201,
          displayId: result.payload.displayId || null,
          alreadySynced: Boolean(result.payload.alreadySynced),
          message: result.payload.message || null,
          errors: result.payload.errors || null
        });
      } catch (e) {
        results.push({
          reportId: item.reportId,
          ok: false,
          message: e.message,
          errors: [{ field: 'reportId', message: e.message }]
        });
      }
    }
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
    res.json({ count: reports.length, reports: reports.map(toPublicReport) });
  } catch (e) {
    next(e);
  }
}

// GET /api/field-incidents/:reportId — single report lookup.
async function getFieldIncident(req, res, next) {
  try {
    const report = await FieldIncident.findOne({ reportId: req.params.reportId });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(toPublicReport(report));
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createFieldIncident,
  syncFieldIncidents,
  myFieldIncidents,
  getFieldIncident,
  registerFieldIncident,
  toPublicReport
};
