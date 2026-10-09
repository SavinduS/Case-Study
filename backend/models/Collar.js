const mongoose = require('mongoose');
const { COLLAR_STATUS, THREAT_LEVEL } = require('../utils/collarAlertConstants');

// WildlifeCollar from the class diagram: a GPS tracking collar on a tracked animal.
const collarSchema = new mongoose.Schema({
  collarId: { type: String, required: true, unique: true, index: true },
  gpsDeviceId: { type: String, required: true },
  species: { type: String, required: true },
  sex: { type: String, enum: ['Male', 'Female', 'Unknown'], default: 'Unknown' },
  health: { type: String, default: 'Stable' },
  // Drives the queue ordering: elephants conflict with people far more often.
  speciesRisk: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: Object.values(COLLAR_STATUS), default: COLLAR_STATUS.ACTIVE },
  batteryLevel: { type: Number, min: 0, max: 100, default: 100 },
  riskLevel: { type: String, enum: Object.values(THREAT_LEVEL), default: THREAT_LEVEL.MEDIUM },
  lastKnownLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  lastFixAt: { type: Date, default: null },
  lastZoneId: { type: String, default: null }
}, { timestamps: true });

collarSchema.index({ lastKnownLocation: '2dsphere' });

module.exports = mongoose.model('Collar', collarSchema);