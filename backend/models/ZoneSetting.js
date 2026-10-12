const mongoose = require('mongoose');

// Per-zone patrol target the analytics coverage % is measured against:
// coverage = actual patrol hours / requiredHours. Managed from the
// Park Manager's Zone settings page instead of server env config.
const zoneSettingSchema = new mongoose.Schema({
  code: { type: String, unique: true, index: true, required: true, uppercase: true, trim: true },
  name: { type: String, trim: true },
  requiredHours: { type: Number, required: true, min: 0, default: 8 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ZoneSetting', zoneSettingSchema);
