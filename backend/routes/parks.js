const router = require('express').Router();
const {
  getCurrentPark,
  listRangerTeams,
  getNearestRangerTeam
} = require('../controllers/geofenceController');

router.get('/current', getCurrentPark);
router.get('/ranger-teams', listRangerTeams);
// Declared after the list route so '/nearest' is not captured by '/:id' style paths.
router.get('/ranger-teams/nearest', getNearestRangerTeam);

module.exports = router;
