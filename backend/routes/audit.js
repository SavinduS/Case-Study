const router = require('express').Router();
const { listAuditEntries, listDelayedIncidents } = require('../controllers/auditController');
const { operationsAuth } = require('../middlewares/operationsAccess');

// The wildlife monitoring audit trail records who acted on which incident, so
// it is officer/manager only.
router.use(...operationsAuth);

// Registered before '/:alertId' style routes on sibling routers, order is fine here.
router.get('/delayed', listDelayedIncidents);
router.get('/', listAuditEntries);

module.exports = router;