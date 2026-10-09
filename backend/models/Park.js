const mongoose = require('mongoose');

// The park whose boundary is drawn on the operations map.
const parkSchema = new mongoose.Schema({
  parkId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  district: { type: String, default: 'Anuradhapura' },
  boundary: { type: [[Number]], required: true }, // [[lng, lat], ...]
  // Human settlements just outside the boundary, used to escalate threat level.
  settlements: {
    settlementId: { type: String, required: true },
    name: { type: String, required: true },
    position: { type: [Number], required: true } // [lng, lat]
  }
}, { timestamps: true });

module.exports = mongoose.model('Park', parkSchema);