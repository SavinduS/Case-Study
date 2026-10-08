const router = require('express').Router();
const { createIncident, myIncidents } = require('../controllers/incidentController');
const auth = require('../middlewares/auth');

router.post('/', auth, createIncident);
router.get('/mine', auth, myIncidents);

module.exports = router;
