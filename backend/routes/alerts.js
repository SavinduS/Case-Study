const router = require('express').Router();
const {
  getAlerts,
  getAlertById,
  respondToAlert,
  getDispatchAttempts
} = require('../controllers/alertController');
const { operationsAuth } = require('../middlewares/operationsAccess');

// Every alert route is officer/manager only: the queue, the audit trail and the
// response actions are operational data, not public telemetry.
router.use(...operationsAuth);

router.get('/', getAlerts);
router.get('/:alertId', getAlertById);
router.get('/:alertId/dispatch-attempts', getDispatchAttempts);
router.post('/:alertId/respond', respondToAlert);

module.exports = router;