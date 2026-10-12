const BoundaryAlert = require('../models/BoundaryAlert');
const DispatchAttempt = require('../models/DispatchAttempt');
const {
  respondToAlert: applyResponse,
  listAlerts: queryAlerts,
  OPEN_STATUSES
} = require('../services/alertService');
const { RESPONSE_ACTION } = require('../utils/collarAlertConstants');

/**
 * Who performed the action, taken from the verified session token rather than
 * the request body. Trusting a body-supplied `actor` would let any caller write
 * another officer's name into the wildlife monitoring audit trail.
 */
function actorOf(req) {
  return req.user?.name || req.user?.id || 'officer';
}

// GET /api/alerts, GET /api/alerts/:alertId
async function getAlerts(req, res, next) {
  try {
    const { status, includeHandled, limit } = req.query;
    const statuses = status ? String(status).split(',').filter(Boolean) : OPEN_STATUSES;
    const parsedLimit = limit === undefined ? 100 : Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
      return res.status(400).json({ message: 'limit must be an integer between 1 and 500' });
    }
    const alerts = await queryAlerts({
      status: statuses,
      includeHandled: includeHandled === 'true',
      limit: parsedLimit
    });
    res.json(alerts);
  } catch (e) { next(e); }
}

/**
 * Alerts belong to the park, not to an individual officer, so any authorised
 * operations user may read or action any alert in the park — there is no
 * per-owner record to scope by, and `req.user.role` is already enforced by
 * middlewares/operationsAccess.js.
 */
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
    const { action, notes } = req.body ?? {};
    if (!action || !Object.values(RESPONSE_ACTION).includes(action)) {
      return res.status(400).json({
        message: `action must be one of: ${Object.values(RESPONSE_ACTION).join(', ')}`
      });
    }
    if (action === RESPONSE_ACTION.MARK_FALSE_ALARM && (typeof notes !== 'string' || !notes.trim())) {
      return res.status(400).json({ message: 'Notes are required to mark an alert as a false alarm' });
    }
    const { alert, dispatch, ranger } = await applyResponse(req.params.alertId, action, {
      actor: actorOf(req),
      notes: typeof notes === 'string' ? notes : null
    });
    res.json({ alert, dispatch, ranger });
  } catch (e) { next(e); }
}

// GET /api/alerts/:alertId/dispatch-attempts - the retry log for exception flow 3.
async function getDispatchAttempts(req, res, next) {
  try {
    const alert = await BoundaryAlert.findOne({ alertId: req.params.alertId }).lean();
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    const attempts = await DispatchAttempt.find({ alertId: req.params.alertId })
      .sort({ attempt: 1 })
      .lean();
    res.json(attempts);
  } catch (e) { next(e); }
}

module.exports = { getAlerts, getAlertById, respondToAlert, getDispatchAttempts };