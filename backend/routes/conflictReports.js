const router = require('express').Router();
const { optionalAuth } = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const {
  createConflictReport,
  getConflictReport,
  listConflictReports,
  syncConflictReports,
  inboundSms,
  uploadPhoto
} = require('../controllers/conflictReportController');

router.post('/', optionalAuth, createConflictReport);
router.post('/sync', optionalAuth, syncConflictReports);
router.post('/inbound-sms', inboundSms);
router.post('/photo', optionalAuth, uploadPhoto);
router.get('/', optionalAuth, requireRole('officer', 'manager'), listConflictReports);
router.get('/:reportId', getConflictReport);

module.exports = router;
