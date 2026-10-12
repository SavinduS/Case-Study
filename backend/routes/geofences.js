const router = require('express').Router();
const {
  listGeofences,
  getGeofence,
  updateGeofence
} = require('../controllers/geofenceController');
const { operationsAuth } = require('../middlewares/operationsAccess');

// Geofence zones are the park's risk configuration and the officer can toggle
// them from the dashboard, so reads and writes are both restricted.
router.use(...operationsAuth);

router.get('/', listGeofences);
router.get('/:zoneId', getGeofence);
router.put('/:zoneId', updateGeofence);

module.exports = router;