const router = require('express').Router();
const { ingestFixes, reportSignalLost } = require('../controllers/telemetryController');

router.post('/fixes', ingestFixes);
router.put('/collars/:collarId/signal', reportSignalLost);

module.exports = router;
