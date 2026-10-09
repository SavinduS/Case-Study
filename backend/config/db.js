const mongoose = require('mongoose');
const config = require('./index');

/**
 * Atlas drops idle connections, and a laptop that sleeps or changes network
 * comes back with a dead socket. The driver reconnects on its own, but queries
 * issued during the gap are buffered rather than failed, so callers hang until
 * bufferTimeoutMS expires instead of getting an error. The lifecycle handlers
 * below log that window so a stalled deployment is diagnosable from the logs
 * rather than inferred from "the dashboard just stopped updating".
 */

const SERVER_SELECTION_TIMEOUT_MS = 10000;
// Must stay below the mobile client's 20s give-up (see app.js logging) so a
// dead database surfaces as a logged 500 before the client abandons the request.
const BUFFER_TIMEOUT_MS = 10000;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ready states mongoose reports: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting. */
const READY_STATE = { disconnected: 0, connected: 1, connecting: 2, disconnecting: 3 };

let connecting = null;

/**
 * Opens the shared mongoose connection, retrying with exponential backoff.
 *
 * Concurrent callers share one in-flight attempt: the seed scripts, the tests
 * and the server all call this, and without the memo several would race to
 * create competing connections to the same database.
 */
async function connectDB({ retries = MAX_RETRIES } = {}) {
  if (mongoose.connection.readyState === READY_STATE.connected) return mongoose.connection;
  if (connecting) return connecting;

  connecting = (async () => {
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await mongoose.connect(config.mongoUri, {
          serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
          bufferTimeoutMS: BUFFER_TIMEOUT_MS,
          // Atlas sits behind a pooler-friendly driver; let the driver decide
          // whether a write is retryable instead of failing on a stale primary.
          retryWrites: true
        });
        console.log(
          `MongoDB connected (${redact(config.mongoUri)}, db "${mongoose.connection.name}", attempt ${attempt})`
        );
        return mongoose.connection;
      } catch (error) {
        lastError = error;
        console.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${error.message}`);
        if (attempt < retries) await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    throw lastError;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

/** Strips the password from a connection string so it is safe to log. */
function redact(uri) {
  return String(uri).replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
}

mongoose.connection.on('connected', () => console.log('MongoDB connection established'));
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected — driver will reconnect'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
mongoose.connection.on('error', (error) => console.error('MongoDB connection error:', error.message));

/** True only when a query would execute now rather than sit in the buffer. */
function isConnected() {
  return mongoose.connection.readyState === READY_STATE.connected;
}

/** Closes the connection so a shutting-down process does not hang on it. */
async function disconnectDB() {
  connecting = null;
  if (mongoose.connection.readyState === READY_STATE.disconnected) return;
  await mongoose.disconnect();
}

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
module.exports.isConnected = isConnected;
module.exports.redact = redact;