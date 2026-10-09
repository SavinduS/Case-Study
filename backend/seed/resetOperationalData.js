const mongoose = require('mongoose');
const connectDB = require('../config/db');
const BoundaryAlert = require('../models/BoundaryAlert');
const AuditEntry = require('../models/AuditEntry');
const DispatchAttempt = require('../models/DispatchAttempt');
const Collar = require('../models/Collar');
const Geofence = require('../models/Geofence');
const RangerTeam = require('../models/RangerTeam');
const { COLLARS, GEOFENCES, RANGER_TEAMS } = require('./referenceData');

/**
 * Returns the system to the state a demo or test run starts from.
 *
 * Clears operational data (alerts, audit trail, dispatch attempts) and
 * restores the reference data, because telemetry has moved every collar off
 * its seeded position and a collar left inside a high-risk zone would raise
 * a spurious breach on the next tick.
 *
 * Run: node seed/resetOperationalData.js
 */

async function reset() {
  await connectDB();

  const [alerts, audits, attempts] = await Promise.all([
    BoundaryAlert.deleteMany({}),
    AuditEntry.deleteMany({}),
    DispatchAttempt.deleteMany({})
  ]);

  // Collars back to their seeded position and status.
  const collarOps = COLLARS.map((collar) => ({
    updateOne: {
      filter: { collarId: collar.collarId },
      update: {
        $set: {
          lastKnownLocation: collar.lastKnownLocation,
          status: collar.status,
          lastZoneId: null
        }
      },
      upsert: true
    }
  }));
  await Collar.bulkWrite(collarOps);

  // All geofences enabled again.
  await Geofence.updateMany({}, { $set: { enabled: true } });

  // Release only teams a dispatch took off duty; leave seeded on_patrol teams.
  const released = await RangerTeam.updateMany(
    { status: 'dispatched' },
    { $set: { status: 'available' } }
  );

  console.log(`  Alerts cleared:         ${alerts.deletedCount}`);
  console.log(`  Audit entries cleared:  ${audits.deletedCount}`);
  console.log(`  Dispatch attempts:      ${attempts.deletedCount}`);
  console.log(`  Collars restored:       ${COLLARS.length} (position + status)`);
  console.log(`  Geofences enabled:      ${GEOFENCES.length}`);
  console.log(`  Ranger teams released:  ${released.modifiedCount}`);
  console.log('Reset complete.');
}

reset()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Reset failed:', error.message);
    process.exit(1);
  });