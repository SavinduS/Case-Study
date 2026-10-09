const mongoose = require('mongoose');
const { AUDIT_ACTION } = require('../utils/collarAlertConstants');

// Append-only wildlife monitoring audit trail. Every system and officer
// action writes here (main flow, final step).
const auditEntrySchema = new mongoose.Schema({
  auditId: { type: String, required: true, unique: true, index: true },
  alertId: { type: String, default: null, index: true },
  action: { type: String, enum: Object.values(AUDIT_ACTION), required: true },
  actor: { type: String, required: true },
  detail: { type: String, required: true },
  at: { type: Date, default: Date.now, index: true }
});

auditEntrySchema.index({ at: -1 });

module.exports = mongoose.model('AuditEntry', auditEntrySchema);