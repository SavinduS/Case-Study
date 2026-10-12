const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Park = require('../models/Park');
const Geofence = require('../models/Geofence');
const Collar = require('../models/Collar');
const RangerTeam = require('../models/RangerTeam');
<<<<<<< Updated upstream
=======
const User = require('../models/User');
const ZoneSetting = require('../models/ZoneSetting');
const { SECTORS } = require('../config/areas');
const { DEFAULT_REQUIRED_HOURS } = require('../services/analyticsService');
>>>>>>> Stashed changes
const { PARK, GEOFENCES, COLLARS, RANGER_TEAMS } = require('./referenceData');

/**
 * Seeds the reference data the operations dashboard needs: the park boundary,
 * the pre-configured high-risk geofences, the tracked collars and the ranger
 * teams. Safe to re-run - it upserts on the natural key of each document.
 *
 * Run: node seed/seedReferenceData.js
 */

async function upsertAll(model, key, rows) {
  const ops = rows.map((row) => ({
    updateOne: {
      filter: { [key]: row[key] },
      update: { $set: row },
      upsert: true
    }
  }));
  const result = await model.bulkWrite(ops);
  return result.upsertedCount + result.modifiedCount;
}

async function seed() {
  await connectDB();
  console.log('Connected. Seeding reference data...');

  const park = await upsertAll(Park, 'parkId', [PARK]);
  const zones = await upsertAll(Geofence, 'zoneId', GEOFENCES);
  const collars = await upsertAll(Collar, 'collarId', COLLARS);
  const teams = await upsertAll(RangerTeam, 'rangerId', RANGER_TEAMS);
<<<<<<< Updated upstream
=======
  // Login keeps the existing id when a demo user already exists, so tokens
  // issued earlier stay valid across a re-seed.
  const users = await upsertAll(User, 'phone', await hashDemoUsers());
  // Zone patrol targets: insert defaults only, never overwrite a manager's edits.
  const zoneOps = SECTORS.map((s) => ({
    updateOne: {
      filter: { code: s.code },
      update: { $set: { name: s.name }, $setOnInsert: { requiredHours: DEFAULT_REQUIRED_HOURS } },
      upsert: true
    }
  }));
  const zoneResult = await ZoneSetting.bulkWrite(zoneOps);
  const zonesSet = zoneResult.upsertedCount;
>>>>>>> Stashed changes

  console.log(`  Park:            ${park} (${PARK.name})`);
  console.log(`  Geofences:       ${zones} high-risk zones`);
  console.log(`  Collars:         ${collars} tracked animals`);
  console.log(`  Ranger teams:    ${teams}`);
<<<<<<< Updated upstream
=======
  console.log(`  Demo users:      ${users} (one per role, password "${DEMO_PASSWORD}")`);
  console.log(`  Zone settings:   ${zonesSet} defaults inserted (${DEFAULT_REQUIRED_HOURS}h per zone)`);
>>>>>>> Stashed changes
  console.log('Seed complete.');
}

seed()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exit(1);
  });