const { SECTORS } = require('../../config/areas');
const ConflictReport = require('../../models/ConflictReport');

/**
 * Fixtures for the analytics suites.
 *
 * These are test inputs only - the application never reads this module. Records
 * are placed exactly on sector centres so zone assignment is deterministic, and
 * timestamps are fixed so coverage gaps and period bounds can be asserted
 * precisely rather than relative to the day the suite happens to run.
 */

const NORTH = SECTORS.find((s) => s.code === 'NORTHBOUNDARY');
const EAST = SECTORS.find((s) => s.code === 'EASTBOUNDARY');
const SOUTH = SECTORS.find((s) => s.code === 'SOUTHBOUNDARY');

/**
 * A ConflictReport document. `createdAt` drives both the window and the week.
 *
 * incidentType uses the real ConflictReport enum (see models/ConflictReport.js)
 * so the fixtures satisfy schema validation; toAnalyticsIncident is what maps
 * these onto the analytics categories crop / poacher / snare / elephant.
 */
function conflictReport({ incidentType = 'crop_damage', sector = NORTH, at = '2026-03-05T09:00:00Z', ...rest } = {}) {
  return {
    reportId: `CR-${Math.random().toString(36).slice(2, 10)}`,
    incidentType,
    description: 'fixture incident',
    status: 'RECEIVED',
    location: { type: 'Point', coordinates: [...sector.center] },
    // createdAt must be supplied on the document itself: the generated report
    // window filters on it, and the schema's timestamps plugin only honours it
    // on insert.
    createdAt: new Date(at),
    ...rest
  };
}

/** A PatrolRecord document. */
function patrolRecord({ sector = NORTH, startedAt, endedAt, ...rest } = {}) {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  return {
    sector: sector.code,
    startedAt: start,
    endedAt: end,
    location: { type: 'Point', coordinates: [...sector.center] },
    ...rest
  };
}

/** Standard successful window: one week inside March 2026. */
const WINDOW = { startDate: '2026-03-01', endDate: '2026-03-31' };

/** The immediately preceding equivalent-length window, for baseline tests. */
const PREVIOUS_WINDOW = { startDate: '2026-01-29', endDate: '2026-02-28' };

const criteria = (overrides = {}) => ({
  reportType: 'overview',
  zones: [NORTH.code],
  categories: [],
  ...WINDOW,
  ...overrides
});

/** Incidents and patrols that make a report complete (no partial reasons). */
function completeDataset() {
  return {
    incidents: [
      conflictReport({ incidentType: 'crop_damage', sector: NORTH, at: '2026-03-02T09:00:00Z' }),
      conflictReport({ incidentType: 'elephant_sighting', sector: NORTH, at: '2026-03-04T09:00:00Z' }),
      conflictReport({ incidentType: 'wildlife_blocking_road', sector: NORTH, at: '2026-03-10T09:00:00Z' })
    ],
    patrols: [
      // Spans the whole window, so every day in the period is covered and no
      // gap reason is produced.
      patrolRecord({
        sector: NORTH,
        startedAt: '2026-03-01T00:00:00Z',
        endedAt: '2026-04-01T00:00:00Z'
      })
    ]
  };
}

/**
 * Inserts ConflictReport documents with explicit createdAt values.
 *
 * insertMany honours a createdAt supplied on the document, so the fixtures can
 * sit inside a historical period. (An updateOne with $set createdAt does not:
 * the schema's timestamps plugin rewrites it on every write, which would put
 * every record back at "now" and outside the window under test.)
 */
async function seedConflicts(docs) {
  return ConflictReport.insertMany(docs);
}

module.exports = {
  SECTORS,
  NORTH,
  EAST,
  SOUTH,
  WINDOW,
  PREVIOUS_WINDOW,
  criteria,
  conflictReport,
  patrolRecord,
  completeDataset,
  seedConflicts,
  ConflictReport
};