const router = require('express').Router();
const { optionalAuth } = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const { createPatrol } = require('../controllers/patrolController');

// Rangers log patrols; managers may log on their behalf. The no-login
// demonstration mode stays usable (audited as demo), other roles are refused.
router.use(optionalAuth);
router.post('/', (req, res, next) => {
  if (!req.user) return next();
  if (req.user.role === 'manager' || req.user.role === 'ranger') return next();
  return requireRole('manager', 'ranger')(req, res, next);
}, createPatrol);

module.exports = router;
