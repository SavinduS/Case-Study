const router = require('express').Router();
const { listCollars, getCollar, registerCollar, updateCollarStatus } = require('../controllers/collarController');
const { operationsAuth } = require('../middlewares/operationsAccess');

// The collar registry exposes tracked animals and their live positions, so it
// is officer/manager only rather than open telemetry.
router.use(...operationsAuth);

router.get('/', listCollars);
router.get('/:collarId', getCollar);
router.post('/', registerCollar);
router.put('/:collarId/status', updateCollarStatus);

module.exports = router;