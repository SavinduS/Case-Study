const AuditEntry = require('../models/AuditEntry');
const { ingestBatch } = require('../services/alertService');

// GET /api/audit?alertId=&limit=
async function listAuditEntries(req, res, next) {
  try {
    const { alertId, limit } = req.query;
    const parsedLimit = limit === undefined ? 200 : Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({ message: 'limit must be an integer between 1 and 1000' });
    }
    const filter = alertId ? { alertId } : {};
    const entries = await AuditEntry.find(filter)
      .sort({ at: -1 })
      .limit(parsedLimit)
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
