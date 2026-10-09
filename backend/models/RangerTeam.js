const mongoose = require('mongoose');
const { RANGER_STATUS } = require('../utils/collarAlertConstants');

// A ranger team that can be dispatched to a boundary breach.
const rangerTeamSchema = new mongoose.Schema({
  rangerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  status: { type: String, enum: Object.values(RANGER_STATUS), default: RANGER_STATUS.AVAILABLE },
  position: { type: [Number], required: true }, // [lng, lat]
  contactChannel: { type: String, default: 'mobile-app' }
}, { timestamps: true });

module.exports = mongoose.model('RangerTeam', rangerTeamSchema);