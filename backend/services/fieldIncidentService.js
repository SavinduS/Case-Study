const fs = require('fs');
const FieldIncident = require('../models/FieldIncident');
const { validateFieldIncident } = require('../utils/validateFieldIncident');
const { nextFieldIncidentDisplayId } = require('../utils/fieldIncidentDisplayId');

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
// problems are 400.
function statusForValidationErrors(errors) {
  const photoErrors = errors.filter((e) => e.field === 'photo');
  if (photoErrors.some((e) => /Only JPEG or PNG/.test(e.message))) return 415;
  if (photoErrors.some((e) => /5 MB/.test(e.message))) return 413;
  return 400;
}

// Best-effort removal of an uploaded photo the server will not keep
// (validation failure or storage crash). Never throws.
function removeUploadedFile(uploadedPath) {
  if (!uploadedPath) return;
  fs.unlink(uploadedPath, () => {});
}

// Shared core: idempotency (by device reportId) -> validate -> store.
// Returns { status, payload } following the conflict-report registerReport
// convention (201 created, 200 already-synced, 400/413/415 validation).
// `uploadedPath` is the raw multer file path to clean up when nothing is
// stored; the normalized `file` ({ path, mimetype, size }) is validated.
async function registerFieldIncident({ body = {}, file = null, reporter = null, uploadedPath = null }) {
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
    removeUploadedFile(uploadedPath);
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
    removeUploadedFile(uploadedPath);
    throw e;
  }
}

// Bulk offline upload orchestration: idempotent per reportId, individual
// item failures never abort the batch. Returns the per-item results; the
// HTTP layer counts and serializes them.
async function syncReports(reports, reporter) {
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
        reporter: reporter || null
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
  return results;
}

module.exports = {
  SYNC_BATCH_LIMIT,
  toPublicReport,
  statusForValidationErrors,
  removeUploadedFile,
  registerFieldIncident,
  syncReports
};
