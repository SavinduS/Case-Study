const mongoose = require('mongoose');
const {
  FIELD_INCIDENT_TYPES,
  FIELD_INCIDENT_LOCATION_SOURCES
} = require('../utils/fieldIncidentTypes');

// F1: Log Field Incident Offline — server-side record of a ranger's report.
// Kept separate from models/Incident.js (generic scaffold sample) and
// models/ConflictReport.js (villager SMS/app flow) so the use cases never
// collide. F2/F3 add the route, controller and service; the service sets
// displayId via utils/fieldIncidentDisplayId.js and receivedAt on arrival.
const fieldIncidentSchema = new mongoose.Schema({
  // UUID generated on the mobile device; unique index makes retried uploads
  // idempotent (same reportId twice returns the stored report, F3).
  reportId: { type: String, required: true, unique: true },
  // Server-generated human-readable ID, e.g. FI-2026-0001. Sparse so the
  // document can be validated before the F2 service assigns it.
  displayId: { type: String, unique: true, sparse: true },
  incidentType: { type: String, enum: FIELD_INCIDENT_TYPES, required: true },
  description: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
    source: { type: String, enum: FIELD_INCIDENT_LOCATION_SOURCES, default: 'gps' },
    accuracy: { type: Number, min: 0 } // optional GPS accuracy in meters
  },
  // Device timestamp of the incident; validator rejects far-future values.
  capturedAt: { type: Date, required: true },
  // Server time the report arrived (i.e. when it became Synchronized).
  receivedAt: { type: Date, default: Date.now },
  photo: {
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  patrolId: { type: String }
}, { timestamps: true });

fieldIncidentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('FieldIncident', fieldIncidentSchema);
