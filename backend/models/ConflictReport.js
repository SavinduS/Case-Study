const mongoose = require('mongoose');

const INCIDENT_TYPES = [
  'elephant_sighting',
  'crop_damage',
  'wildlife_near_home',
  'wildlife_blocking_road',
  'other_wildlife_conflict'
];

// Evaluation doc §13 lifecycle. Device-side SUBMITTED/PENDING_UPLOAD never
// reaches the server; an accepted report is created directly at RECEIVED.
const STATUSES = ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED'];

const conflictReportSchema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true },
  incidentType: { type: String, enum: INCIDENT_TYPES, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  locationText: String,
  accuracyMeters: Number,
  description: { type: String, maxlength: 500 },
  photoUrl: String,
  reporterContact: String,
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: STATUSES, default: 'RECEIVED' },
  submissionMethod: { type: String, enum: ['app', 'sms'], default: 'app' },
  clientRefId: { type: String, index: true, unique: true, sparse: true },
  possibleDuplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'ConflictReport' },
  isPossibleDuplicate: { type: Boolean, default: false },
  outsideSupportedArea: { type: Boolean, default: false },
  smsFrom: String
}, { timestamps: true });

conflictReportSchema.index({ location: '2dsphere' });

const ConflictReport = mongoose.model('ConflictReport', conflictReportSchema);
ConflictReport.INCIDENT_TYPES = INCIDENT_TYPES;
ConflictReport.STATUSES = STATUSES;

module.exports = ConflictReport;
