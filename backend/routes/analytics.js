const router = require('express').Router();
const { optionalAuth } = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const controller = require('../controllers/analyticsController');

// Member 2 is delivered in the assignment's no-login demonstration mode.
// Authenticated managers are still restricted to their own saved reports.
router.use(optionalAuth);
router.use((req, res, next) => {
  if (!req.user || req.user.role === 'manager') return next();
  return requireRole('manager')(req, res, next);
});
router.post('/generate', controller.generate);
router.get('/reports', controller.list);
router.get('/reports/:id/export', controller.exportReport);
router.get('/reports/:id', controller.get);
router.get('/zones/:code/records', controller.zoneRecords);

module.exports = router;
