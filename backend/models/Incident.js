const mongoose = require('mongoose');

// Covers UC1 conflict report + UC3 field incident in one sample model
const incidentSchema = new mongoose.Schema({
  type: { type: String, enum: ['elephant', 'crop', 'poacher', 'snare'], required: true },
  description: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  locationText: String,
  photoUrl: String,
  source: { type: String, enum: ['sms', 'app'], default: 'app' },
  syncStatus: { type: String, enum: ['pending', 'synchronized'], default: 'synchronized' },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

incidentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Incident', incidentSchema);
