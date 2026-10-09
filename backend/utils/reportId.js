const Counter = require('../models/Counter');

// CR-2026-001245 — sequential per year, atomic via Counter document
async function nextReportId(now = new Date()) {
  const year = now.getUTCFullYear();
  const counter = await Counter.findOneAndUpdate(
    { key: `conflict-report-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `CR-${year}-${String(counter.seq).padStart(6, '0')}`;
}

module.exports = { nextReportId };
