const mongoose = require('mongoose');

// The park whose boundary is drawn on the operations map.
const parkSchema = new mongoose.Schema({
  parkId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  district: { type: String, default: 'Anuradhapura' },
  boundary: { type: [[Number]], required: true }, // [[lng, lat], ...]
  // Human settlements just outside the boundary, used to escalate threat level.
  // This is a list: alertService iterates it to find the nearest one, and the
  // seed writes three. It used to be declared as one nested object, which only
  // survived because upserts use $set and every read uses .lean() - neither of
  // which runs schema validation.
  settlements: {
    type: [{
      settlementId: { type: String, required: true },
      name: { type: String, required: true },
      position: { type: [Number], required: true } // [lng, lat]
    }],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Park', parkSchema);