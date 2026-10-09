const router = require('express').Router();
const {
  getAlerts,
  getAlertById,
  respondToAlert,
  getDispatchAttempts
} = require('../controllers/alertController');

router.get('/', getAlerts);
router.get('/:alertId', getAlertById);
router.get('/:alertId/dispatch-attempts', getDispatchAttempts);
router.post('/:alertId/respond', respondToAlert);

module.exports = router;
