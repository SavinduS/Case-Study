const mongoose = require('mongoose');
const { DISPATCH_STATE } = require('../utils/collarAlertConstants');

// One row per delivery attempt to the ranger mobile unit. Exception flow 3
// retries up to three times, so each attempt is recorded separately.
const dispatchAttemptSchema = new mongoose.Schema({
  alertId: { type: String, required: true, index: true },
  rangerId: { type: String, default: null },
  rangerName: { type: String, default: null },
  attempt: { type: Number, required: true },
  state: { type: String, enum: Object.values(DISPATCH_STATE), required: true },
  channel: { type: String, default: 'mobile-app' },
  error: { type: String, default: null },
  at: { type: Date, default: Date.now }
});

dispatchAttemptSchema.index({ alertId: 1, attempt: 1 });

module.exports = mongoose.model('DispatchAttempt', dispatchAttemptSchema);