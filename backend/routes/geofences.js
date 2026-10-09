const router = require('express').Router();
const {
  listGeofences,
  getGeofence,
  updateGeofence
} = require('../controllers/geofenceController');

router.get('/', listGeofences);
router.get('/:zoneId', getGeofence);
router.put('/:zoneId', updateGeofence);

module.exports = router;
