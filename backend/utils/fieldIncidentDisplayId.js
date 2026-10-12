const Counter = require('../models/Counter');

// FI-2026-0001 — server-generated human-readable display ID for field
// incidents. Sequential per year and atomic via the shared Counter document,
// using the same mechanism as utils/reportId.js (which uses the
// `conflict-report-<year>` key and the CR- prefix). A dedicated
// `field-incident-<year>` key keeps the two sequences independent so IDs can
// never collide with conflict reports, and the atomic $inc means concurrent
// uploads cannot receive the same display ID.
async function nextFieldIncidentDisplayId(now = new Date()) {
  const year = now.getUTCFullYear();
  const counter = await Counter.findOneAndUpdate(
    { key: `field-incident-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `FI-${year}-${String(counter.seq).padStart(4, '0')}`;
}

module.exports = { nextFieldIncidentDisplayId };
