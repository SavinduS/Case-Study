const router = require('express').Router();
const {
  getCurrentPark,
  listRangerTeams,
  getNearestRangerTeam
} = require('../controllers/geofenceController');
const { operationsAuth } = require('../middlewares/operationsAccess');

// The park boundary, the surrounding settlements and ranger team positions are
// operational data the dashboard renders, so they need a session too.
router.use(...operationsAuth);

router.get('/current', getCurrentPark);
router.get('/ranger-teams', listRangerTeams);
// Declared after the list route so '/nearest' is not captured by '/:id' style paths.
router.get('/ranger-teams/nearest', getNearestRangerTeam);

module.exports = router;