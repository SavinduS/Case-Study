const mongoose = require('mongoose');

const analyticsReportSchema = new mongoose.Schema({
  reportId: { type: String, unique: true, index: true, required: true },
  name: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  criteria: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['complete', 'partial'], required: true },
  partialReasons: [String],
  generatedAt: { type: Date, default: Date.now },
  summary: mongoose.Schema.Types.Mixed,
  incidentDensity: mongoose.Schema.Types.Mixed,
  patrolCoverage: mongoose.Schema.Types.Mixed,
  weeklyTrends: mongoose.Schema.Types.Mixed,
  categoryTrends: mongoose.Schema.Types.Mixed,
  categoryTrendDirections: mongoose.Schema.Types.Mixed,
  terrainTrend: mongoose.Schema.Types.Mixed,
  comparison: mongoose.Schema.Types.Mixed,
  reportType: { type: String, enum: ['overview', 'patrolCoverage', 'incidentSummary', 'terrainTrend'] },
  output: mongoose.Schema.Types.Mixed,
  recommendations: [String]
}, { timestamps: true });

module.exports = mongoose.model('AnalyticsReport', analyticsReportSchema);
