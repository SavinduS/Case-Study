const AuditEntry = require('../models/AuditEntry');
const { ingestBatch } = require('../services/alertService');

// GET /api/audit?alertId=&limit=
async function listAuditEntries(req, res, next) {
  try {
    const { alertId, limit } = req.query;
    const filter = alertId ? { alertId } : {};
    const entries = await AuditEntry.find(filter)
      .sort({ at: -1 })
      .limit(limit ? Number(limit) : 200)
      .lean();
    res.json(entries);
  } catch (e) { next(e); }
}

// GET /api/audit/delayed - every retroactive breach reconstructed from a
// batch upload, so the officer can review them in one place (alternate flow D).
async function listDelayedIncidents(req, res, next) {
  try {
    const BoundaryAlert = require('../models/BoundaryAlert');
    const alerts = await BoundaryAlert.find({ delayed: true })
      .sort({ detectedAt: -1 })
      .lean();
    res.json(alerts);
  } catch (e) { next(e); }
}

module.exports = { listAuditEntries, listDelayedIncidents };
