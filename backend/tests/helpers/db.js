const mongoose = require('mongoose');
const { ConnectionString } = require('mongodb-connection-string-url');
const config = require('../../config');

/**
 * Tests run against a dedicated wildlife_test database so the dev cluster data
 * is never touched.
 *
 * Each Jest suite gets its own database, derived from its file name. The suites
 * share one remote MongoDB instance, and `dropDatabase()` from a finishing suite
 * was racing the next suite's first write: a login could answer 401 for a user
 * that had just been created, and a count could read 0 straight after an
 * insert. Isolating by suite removes the shared state entirely - the only thing
 * that touches a suite's data is that suite.
 */
const SUITE_DATABASES = new Map();
const SUITE_COUNTER = { next: 1 };

function suiteName() {
  const state = typeof expect !== 'undefined' && expect.getState ? expect.getState() : null;
  const path = state?.testPath ?? process.env.JEST_WORKER_ID ?? 'default';
  const base = String(path).split(/[\\/]/).pop().replace(/\.test\.(c|m)?js$/i, '').replace(/[^a-z0-9]/gi, '');
  return base || 'suite';
}

function testDatabaseName() {
  const name = suiteName();
  if (!SUITE_DATABASES.has(name)) {
    SUITE_DATABASES.set(name, `wildlife_test_${SUITE_COUNTER.next++}_${name.toLowerCase().slice(0, 24)}`);
  }
  return SUITE_DATABASES.get(name);
}

function testUri() {
  const cs = new ConnectionString(config.mongoUri);
  cs.pathname = `/${testDatabaseName()}`;
  return cs.toString();
}

async function connectTestDb() {
  await mongoose.connect(testUri(), {
    serverSelectionTimeoutMS: 15000,
    // Majority writes make a read immediately after a write see it, which is
    // what every assertion in these suites assumes.
    writeConcern: { w: 'majority' },
    readPreference: 'primary'
  });
}

async function resetTestDb() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

module.exports = { connectTestDb, resetTestDb, disconnectTestDb, testUri, testDatabaseName };