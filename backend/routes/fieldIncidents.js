const router = require('express').Router();
const auth = require('../middlewares/auth');
const {
  createFieldIncident,
  syncFieldIncidents,
  myFieldIncidents,
  getFieldIncident
} = require('../controllers/fieldIncidentController');

// Log Field Incident Offline — ranger offline capture + sync.
// All endpoints require authentication (no login/logout here).
// NOTE: '/mine' and '/sync' are registered before '/:reportId' so the
// literal paths are not captured as a reportId parameter.
router.post('/', auth, createFieldIncident);
router.post('/sync', auth, syncFieldIncidents);
router.get('/mine', auth, myFieldIncidents);
router.get('/:reportId', auth, getFieldIncident);

module.exports = router;
