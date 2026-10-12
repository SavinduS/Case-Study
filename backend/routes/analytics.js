const router = require('express').Router();
const { optionalAuth } = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const controller = require('../controllers/analyticsController');

// Member 2 is delivered in the assignment's no-login demonstration mode.
// Authenticated dashboards are restricted to the two roles that use the
// analytics workspace: the Park Manager, and the Operations Officer, who needs
// the same incident and patrol figures to judge how urgent a dispatch is.
// Villagers and rangers are still refused.
router.use(optionalAuth);
router.use((req, res, next) => {
  if (!req.user || req.user.role === 'manager' || req.user.role === 'officer') return next();
  return requireRole('manager', 'officer')(req, res, next);
});
router.post('/generate', controller.generate);
router.get('/reports', controller.list);
router.get('/reports/:id/export', controller.exportReport);
router.get('/reports/:id', controller.get);
router.get('/zones/:code/records', controller.zoneRecords);

module.exports = router;