const mongoose = require('mongoose');
const { RANGER_STATUS } = require('../utils/collarAlertConstants');

// A ranger team that can be dispatched to a boundary breach.
const rangerTeamSchema = new mongoose.Schema({
  rangerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  status: { type: String, enum: Object.values(RANGER_STATUS), default: RANGER_STATUS.AVAILABLE },
  position: { type: [Number], required: true }, // [lng, lat]
  contactChannel: { type: String, default: 'mobile-app' },
  // Whether the team's handset can actually be reached. The real ranger mobile
  // app and its gateway are not part of this deployment, so the bundled mock
  // notification adapter (services/notificationService.js) uses this flag to
  // exercise the real retry and "Failed Delivery" path. With a configured
  // RANGER_GATEWAY_URL the flag is ignored and the HTTP answer decides.
  gatewayReachable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('RangerTeam', rangerTeamSchema);