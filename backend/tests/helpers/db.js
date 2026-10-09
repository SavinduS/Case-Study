const mongoose = require('mongoose');
const { ConnectionString } = require('mongodb-connection-string-url');
const config = require('../../config');

// Tests run against a dedicated wildlife_test database so the dev cluster
// data is never touched.
function testUri() {
  const cs = new ConnectionString(config.mongoUri);
  cs.pathname = '/wildlife_test';
  return cs.toString();
}

async function connectTestDb() {
  await mongoose.connect(testUri(), { serverSelectionTimeoutMS: 15000 });
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

module.exports = { connectTestDb, resetTestDb, disconnectTestDb };
