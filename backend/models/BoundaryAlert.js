const mongoose = require('mongoose');
const {
  ALERT_STATUS,
  THREAT_LEVEL,
  DISPATCH_STATE
} = require('../utils/collarAlertConstants');

// The incident record written by WildlifeDB.saveAlertRecord(). One document
// per breach episode; officer responses mutate it and append to AuditEntry.
const boundaryAlertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true, index: true },
  collarId: { type: String, required: true, index: true },
  gpsDeviceId: { type: String, default: null },
  species: { type: String, required: true },
  sex: { type: String, default: 'Unknown' },
  health: { type: String, default: 'Stable' },
  speciesRisk: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },

  zoneId: { type: String, required: true },
  zoneName: { type: String, required: true },
  gridRef: { type: String, required: true },
  zoneKind: { type: String, default: 'other' },
  zoneThreatLevel: { type: String, enum: Object.values(THREAT_LEVEL), default: THREAT_LEVEL.LOW },

  threatLevel: { type: String, enum: Object.values(THREAT_LEVEL), required: true, index: true },
  // Stored so the queue order can be served straight from the database.
  priorityScore: { type: Number, default: 0, index: true },

  position: { type: [Number], required: true }, // [lng, lat]
  depthInsideM: { type: Number, default: 0 },
  distanceToBoundaryM: { type: Number, default: 0 },
  distanceToSettlementM: { type: Number, default: null },

  detectedAt: { type: Date, required: true },
  status: { type: String, enum: Object.values(ALERT_STATUS), default: ALERT_STATUS.ACTIVE, index: true },
  // Set to "<collarId>:<zoneId>" while the episode is open; see the unique
  // partial index below. Cleared when the officer handles the alert.
  episodeKey: { type: String, default: null },
  // True when reconstructed from a batch upload after a dropout (alternate flow D).
  delayed: { type: Boolean, default: false },
  details: { type: String, required: true },

  notes: { type: String, default: null },
  handledBy: { type: String, default: null },
  handledAt: { type: Date, default: null },
  responseAction: { type: String, default: null },

  dispatchedTo: { type: String, default: null },
  dispatchedRangerId: { type: String, default: null },
  dispatchState: { type: String, enum: Object.values(DISPATCH_STATE), default: DISPATCH_STATE.IDLE },
  dispatchAttempts: { type: Number, default: 0 }
}, { timestamps: true });

boundaryAlertSchema.index({ status: 1, priorityScore: -1, detectedAt: -1 });

/**
 * One open alert per collar/zone breach episode, enforced by the database
 * rather than by a check-then-act query. While an episode is open the field
 * holds "<collarId>:<zoneId>"; it is cleared once the officer dismisses or
 * resolves the alert, which lets a genuine later breach raise a new one.
 *
 * The partial filter means only documents that actually carry a string are
 * indexed, so any number of handled alerts can coexist.
 */
boundaryAlertSchema.index(
  { episodeKey: 1 },
  { unique: true, partialFilterExpression: { episodeKey: { $type: 'string' } } }
);

module.exports = mongoose.model('BoundaryAlert', boundaryAlertSchema);