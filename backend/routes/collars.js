const router = require('express').Router();
const { listCollars, getCollar, registerCollar, updateCollarStatus } = require('../controllers/collarController');

router.get('/', listCollars);
router.get('/:collarId', getCollar);
router.post('/', registerCollar);
router.put('/:collarId/status', updateCollarStatus);

module.exports = router;
