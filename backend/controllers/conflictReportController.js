const ConflictReport = require('../models/ConflictReport');
const SmsReviewQueue = require('../models/SmsReviewQueue');
const { nextReportId } = require('../utils/reportId');
const { validateConflictReport } = require('../utils/validateConflictReport');
const { findPossibleDuplicate } = require('../utils/duplicate');
const { findSectorForPoint, findSectorByCode, allowOutsideArea } = require('../config/areas');
const { parseSms, typeMenuReply, areaHelpReply } = require('../utils/smsParser');
const { upload } = require('../utils/upload');

const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const SYNC_BATCH_LIMIT = 100;

function toPublicReport(r) {
  return {
    reportId: r.reportId,
    incidentType: r.incidentType,
    status: r.status,
    submissionMethod: r.submissionMethod,
    location: r.location,
    locationText: r.locationText,
    accuracyMeters: r.accuracyMeters,
    description: r.description,
    photoUrl: r.photoUrl,
    isPossibleDuplicate: r.isPossibleDuplicate,
    outsideSupportedArea: r.outsideSupportedArea,
    createdAt: r.createdAt
  };
}

function toOfficerReport(r) {
  return {
    ...toPublicReport(r),
    reporterContact: r.reporterContact,
    possibleDuplicateOf: r.possibleDuplicateOf || null
  };
}

// Shared core: validate (E1) -> area policy (E2) -> idempotency -> duplicate (E4) -> store
async function registerReport({ body = {}, method = 'app', reporter = null, smsFrom = null }) {
  const { ok, errors, value } = validateConflictReport(body, { method });
  if (!ok) return { status: 400, payload: { message: 'Validation failed', errors } };

  const [lng, lat] = value.location.coordinates;
  const sector = findSectorForPoint(lng, lat);
  if (!sector && !allowOutsideArea) {
    return {
      status: 422,
      payload: { code: 'OUTSIDE_SUPPORTED_AREA', message: 'Location is outside the supported reporting area' }
    };
  }

  if (body.clientRefId) {
    const existing = await ConflictReport.findOne({ clientRefId: String(body.clientRefId) });
    if (existing) {
      return { status: 200, payload: { ...toPublicReport(existing), alreadySynced: true } };
    }
  }

  const duplicate = await findPossibleDuplicate({
    incidentType: value.incidentType,
    coordinates: value.location.coordinates
  });

  const reportId = await nextReportId();
  const report = await ConflictReport.create({
    ...value,
    reportId,
    status: 'RECEIVED',
    submissionMethod: method,
    reporter,
    smsFrom,
    clientRefId: body.clientRefId ? String(body.clientRefId) : undefined,
    locationText: value.locationText || (sector ? sector.name : undefined),
    outsideSupportedArea: !sector,
    isPossibleDuplicate: Boolean(duplicate),
    possibleDuplicateOf: duplicate ? duplicate._id : undefined
  });

  return {
    status: 201,
    payload: {
      ...toPublicReport(report),
      duplicateOfReportId: duplicate ? duplicate.reportId : null
    }
  };
}

// POST /api/conflict-reports — FR-01, FR-08..FR-12, ends at RECEIVED (no dispatch)
async function createConflictReport(req, res, next) {
  try {
    const result = await registerReport({
      body: req.body,
      method: 'app',
      reporter: req.user?.id || null
    });
    res.status(result.status).json(result.payload);
  } catch (e) { next(e); }
}

// GET /api/conflict-reports/:reportId — villager/confirmation status lookup
async function getConflictReport(req, res, next) {
  try {
    const report = await ConflictReport.findOne({ reportId: req.params.reportId });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(toPublicReport(report));
  } catch (e) { next(e); }
}

// GET /api/conflict-reports — FR-11 dashboard feed (role-guarded in routes)
async function listConflictReports(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query.incidentType) filter.incidentType = String(req.query.incidentType);
    if (req.query.since) {
      const since = new Date(req.query.since);
      if (Number.isNaN(since.getTime())) {
        return res.status(400).json({ message: 'since must be an ISO date string' });
      }
      filter.createdAt = { $gte: since };
    }
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const reports = await ConflictReport.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json({ count: reports.length, reports: reports.map(toOfficerReport) });
  } catch (e) { next(e); }
}

// POST /api/conflict-reports/sync — FR-13/FR-14 offline queue upload, idempotent per clientRefId
async function syncConflictReports(req, res, next) {
  try {
    const reports = req.body && Array.isArray(req.body.reports) ? req.body.reports : null;
    if (!reports) return res.status(400).json({ message: 'Body must be { reports: [...] }' });
    if (reports.length > SYNC_BATCH_LIMIT) {
      return res.status(400).json({ message: `Too many reports (max ${SYNC_BATCH_LIMIT} per sync)` });
    }

    const results = [];
    for (const item of reports) {
      if (!item || !item.clientRefId) {
        results.push({
          ok: false,
          message: 'clientRefId is required for sync',
          errors: { clientRefId: 'clientRefId is required for sync' }
        });
        continue;
      }
      try {
        const result = await registerReport({
          body: item,
          method: item.submissionMethod === 'sms' ? 'sms' : 'app',
          reporter: req.user?.id || null
        });
        results.push({
          clientRefId: item.clientRefId,
          ok: result.status === 200 || result.status === 201,
          reportId: result.payload.reportId,
          status: result.payload.status,
          alreadySynced: Boolean(result.payload.alreadySynced),
          message: result.payload.message || null,
          errors: result.payload.errors || null
        });
      } catch (e) {
        results.push({
          clientRefId: item.clientRefId,
          ok: false,
          message: e.message,
          errors: { message: e.message }
        });
      }
    }
    res.json({ synced: results.filter((r) => r.ok).length, results });
  } catch (e) { next(e); }
}

// POST /api/conflict-reports/inbound-sms — simulated SMS gateway webhook (FR-02)
async function inboundSms(req, res, next) {
  try {
    const { from, text } = req.body || {};
    if (!from || !text) return res.status(400).json({ message: 'from and text are required' });

    const parsed = parseSms(text);

    if (parsed.outcome === 'complete') {
      const sector = findSectorByCode(parsed.areaCode);
      const result = await registerReport({
        body: {
          incidentType: parsed.incidentType,
          location: { coordinates: sector.center },
          locationText: sector.name,
          reporterContact: from
        },
        method: 'sms',
        smsFrom: from
      });
      if (result.status === 201 || result.status === 200) {
        return res.json({ reportId: result.payload.reportId, reply: `Report received. ID: ${result.payload.reportId}. Wildlife officers have been notified.` });
      }
      return res.json({ reply: 'Your report could not be stored. Please try again later.' });
    }

    if (parsed.outcome === 'menu_reply') {
      const queue = await SmsReviewQueue.findOne({
        phone: String(from),
        status: 'pending',
        createdAt: { $gte: new Date(Date.now() - REVIEW_WINDOW_MS) }
      }).sort({ createdAt: -1 });

      if (queue && queue.parsedAreaCode && !queue.parsedIncidentType) {
        const sector = findSectorByCode(queue.parsedAreaCode);
        const result = await registerReport({
          body: {
            incidentType: parsed.incidentType,
            location: { coordinates: sector.center },
            locationText: sector.name,
            reporterContact: from
          },
          method: 'sms',
          smsFrom: from
        });
        if (result.status === 201 || result.status === 200) {
          queue.status = 'completed';
          await queue.save();
          return res.json({ reportId: result.payload.reportId, reply: `Report received. ID: ${result.payload.reportId}. Wildlife officers have been notified.` });
        }
        return res.json({ reply: 'Your report could not be stored. Please try again later.' });
      }

      if (queue) {
        if (!queue.parsedIncidentType) queue.parsedIncidentType = parsed.incidentType;
        await queue.save();
        return res.json({ reply: areaHelpReply() });
      }
      return res.json({ reply: `${typeMenuReply()} Followed by your area, e.g. 1 NORTHBOUNDARY.` });
    }

    if (parsed.outcome === 'incomplete') {
      await SmsReviewQueue.create({
        phone: String(from),
        rawText: String(text),
        parsedAreaCode: parsed.areaCode || undefined,
        parsedIncidentType: parsed.incidentType || undefined
      });
      const reply =
        parsed.missing === 'type'
          ? typeMenuReply()
          : areaHelpReply();
      return res.json({ reply });
    }

    await SmsReviewQueue.create({ phone: String(from), rawText: String(text) });
    return res.json({ reply: `${typeMenuReply()} Send as e.g. 1 NORTHBOUNDARY.` });
  } catch (e) { next(e); }
}

// POST /api/conflict-reports/photo — optional photo (FR-07), E5 error codes
function uploadPhoto(req, res) {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Photo exceeds the 5 MB limit' });
      }
      if (err.code === 'UNSUPPORTED_TYPE') {
        return res.status(415).json({ message: 'Only JPEG, PNG or WebP photos are supported' });
      }
      return res.status(500).json({ message: 'Photo upload failed' });
    }
    if (!req.file) return res.status(400).json({ message: 'photo file is required (field name: photo)' });
    res.status(201).json({ photoUrl: `/uploads/${req.file.filename}` });
  });
}

module.exports = {
  createConflictReport,
  getConflictReport,
  listConflictReports,
  syncConflictReports,
  inboundSms,
  uploadPhoto,
  registerReport
};
