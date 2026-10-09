const router = require('express').Router();
const { listAuditEntries, listDelayedIncidents } = require('../controllers/auditController');

// Registered before '/:alertId' style routes on sibling routers, order is fine here.
router.get('/delayed', listDelayedIncidents);
router.get('/', listAuditEntries);

module.exports = router;
