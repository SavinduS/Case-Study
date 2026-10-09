const BoundaryAlert = require('../models/BoundaryAlert');
const AuditEntry = require('../models/AuditEntry');
const DispatchAttempt = require('../models/DispatchAttempt');
const {
  respondToAlert: applyResponse,
  listAlerts: queryAlerts,
  OPEN_STATUSES
} = require('../services/alertService');

// GET /api/alerts, GET /api/alerts/:alertId
async function getAlerts(req, res, next) {
  try {
    const { status, includeHandled, limit } = req.query;
    const statuses = status ? String(status).split(',').filter(Boolean) : OPEN_STATUSES;
    const alerts = await queryAlerts({
      status: statuses,
      includeHandled: includeHandled === 'true',
      limit: limit ? Number(limit) : 100
    });
    res.json(alerts);
  } catch (e) { next(e); }
}

async function getAlertById(req, res, next) {
  try {
    const alert = await BoundaryAlert.findOne({ alertId: req.params.alertId }).lean();
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json(alert);
  } catch (e) { next(e); }
}

// POST /api/alerts/:alertId/respond - one endpoint for all four officer actions.
async function respondToAlert(req, res, next) {
  try {
    const { action, notes, actor } = req.body;
    const { alert, dispatch, ranger } = await applyResponse(req.params.alertId, action, {
      actor: actor || 'officer',
      notes
    });
    res.json({ alert, dispatch, ranger });
  } catch (e) { next(e); }
}

// GET /api/alerts/:alertId/dispatch-attempts - the retry log for exception flow 3.
async function getDispatchAttempts(req, res, next) {
  try {
    const attempts = await DispatchAttempt.find({ alertId: req.params.alertId })
      .sort({ attempt: 1 })
      .lean();
    res.json(attempts);
  } catch (e) { next(e); }
}

module.exports = { getAlerts, getAlertById, respondToAlert, getDispatchAttempts };