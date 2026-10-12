const router = require('express').Router();
const { ingestFixes, reportSignalLost } = require('../controllers/telemetryController');
const { gatewayAuth, operatorFallback } = require('../middlewares/gatewayAuth');

// Gateway endpoints, not officer endpoints. See middlewares/gatewayAuth.js: the
// IoT gateway posts fixes with an optional shared secret, and an operator can
// post a fix by hand from a signed-in dashboard session.
router.post('/fixes', gatewayAuth, operatorFallback, ingestFixes);
router.put('/collars/:collarId/signal', gatewayAuth, operatorFallback, reportSignalLost);

module.exports = router;