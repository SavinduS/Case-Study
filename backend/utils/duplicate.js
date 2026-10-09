const ConflictReport = require('../models/ConflictReport');

// Evaluation doc E4: same type, nearby location, recent timestamp.
const DUPLICATE_RADIUS_M = 500;
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

// Pure query builder so the duplicate rules are unit testable
function buildDuplicateQuery({ incidentType, coordinates, now = Date.now() } = {}) {
  const [lng, lat] = coordinates;
  return {
    incidentType,
    createdAt: { $gte: new Date(now - DUPLICATE_WINDOW_MS) },
    location: { $geoWithin: { $centerSphere: [[lng, lat], DUPLICATE_RADIUS_M / 6378137] } }
  };
}

// Returns the most recent matching report, or null (FR-15)
async function findPossibleDuplicate({ incidentType, coordinates, now = Date.now() }) {
  return ConflictReport.findOne(buildDuplicateQuery({ incidentType, coordinates, now }))
    .sort({ createdAt: -1 })
    .select('_id reportId');
}

module.exports = { buildDuplicateQuery, findPossibleDuplicate, DUPLICATE_RADIUS_M, DUPLICATE_WINDOW_MS };
