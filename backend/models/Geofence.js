const mongoose = require('mongoose');
const { THREAT_LEVEL } = require('../utils/collarAlertConstants');

// A pre-configured virtual geofence / high-risk zone. Polygons are stored as
// closed GeoJSON-style [lng, lat] rings so the same shape can be handed to
// the frontend for drawing without conversion.
const geofenceSchema = new mongoose.Schema({
  zoneId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  gridRef: { type: String, required: true },
  // farmland = poaching risk zone, village = conflict zone, road = crossing hazard
  kind: { type: String, enum: ['farmland', 'village', 'road', 'settlement', 'other'], required: true },
  threatLevel: { type: String, enum: Object.values(THREAT_LEVEL), required: true },
  settlementIds: { type: [String], default: [] },
  polygon: { type: [[Number]], required: true }, // [[lng, lat], ...]
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Geofence', geofenceSchema);