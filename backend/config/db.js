const mongoose = require('mongoose');
const config = require('./index');

async function connectDB() {
  // Fail fast: without these, a stalled Atlas connection makes queries wait
  // up to 30s while the mobile client gives up at 20s — the report upload
  // then dies silently. 10s guarantees a logged 500 instead.
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    bufferTimeoutMS: 10000
  });
  console.log('MongoDB connected');
}

module.exports = connectDB;
