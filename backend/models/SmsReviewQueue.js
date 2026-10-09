const mongoose = require('mongoose');

// Evaluation doc §8: SMS messages the system cannot fully parse are stored
// in a manual review queue until the villager replies or staff review them.
const smsReviewQueueSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  rawText: { type: String, required: true },
  parsedAreaCode: String,
  parsedIncidentType: String,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true }
}, { timestamps: true });

module.exports = mongoose.model('SmsReviewQueue', smsReviewQueueSchema);
