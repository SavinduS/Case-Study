const mongoose = require('mongoose');

const patrolRecordSchema = new mongoose.Schema({
  ranger: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sectorCode: String,
  sector: String,
  terrainZone: String,
  patrolDate: Date,
  date: Date,
  startedAt: Date,
  endedAt: Date,
  hours: Number,
  durationHours: Number,
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] },
  notes: String
}, { timestamps: true, collection: 'patrols' });

patrolRecordSchema.index({ startedAt: 1, endedAt: 1 });
patrolRecordSchema.index({ location: '2dsphere' });

patrolRecordSchema.pre('validate', function validateDates(next) {
  if (!this.startedAt) this.startedAt = this.patrolDate || this.date;
  if (!this.endedAt && this.startedAt && Number.isFinite(this.durationHours || this.hours)) {
    this.endedAt = new Date(this.startedAt.getTime() + (this.durationHours || this.hours) * 3600000);
  }
  if (!this.startedAt || !this.endedAt) return next(new Error('patrol dates are required'));
  if (this.endedAt <= this.startedAt) return next(new Error('endedAt must be after startedAt'));
  if (!Number.isFinite(this.hours)) this.hours = (this.endedAt - this.startedAt) / 3600000;
  if (!Number.isFinite(this.durationHours)) this.durationHours = this.hours;
  next();
});

module.exports = mongoose.model('PatrolRecord', patrolRecordSchema);
