const app = require('./app');
const config = require('./config');
const { connectDB, disconnectDB, isConnected, redact } = require('./config/db');
const TelemetryGatewaySimulator = require('./services/telemetrySimulator');

// Listen on the configured port (5000 by default); if it is already busy,
// retry once on the next port (5001) — the mobile client probes both.
function listen(port, allowRetry = true) {
  const server = app.listen(port, () => {
    console.log(`API on :${port} (database ${isConnected() ? 'connected' : 'disconnected'})`);

    // The physical collars and their gateway are not available in this
    // deployment, so the server generates telemetry itself. The browser only
    // ever reads the database. Disable with TELEMETRY_SIMULATOR=false.
    if (process.env.TELEMETRY_SIMULATOR !== 'false') {
      simulator.start();
      console.log('Telemetry gateway simulator started');
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && allowRetry) {
      console.log(`Port ${port} is busy — retrying on ${port + 1}`);
      listen(port + 1, false);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
  return server;
}

// The simulator writes straight to MongoDB, so starting it before the
// connection is up just fills the driver's buffer and delays the first breach
// by the length of the connect timeout. Boot order is connect, then listen,
// then simulate.
async function start() {
  try {
    await connectDB();
  } catch (error) {
    // Retries are already exhausted. Starting without a database would serve
    // 503s from every /api route while the process looked healthy, so exit and
    // let the supervisor restart us.
    console.error(`Cannot reach MongoDB at ${redact(config.mongoUri)}: ${error.message}`);
    process.exit(1);
  }

  const server = listen(config.port);

  // Closing the socket on SIGTERM/SIGINT lets the platform reclaim the port
  // immediately instead of holding it until the connection timeout expires.
  const shutdown = (signal) => async () => {
    console.log(`${signal} received — shutting down`);
    server.close();
    await disconnectDB().catch(() => {});
    process.exit(0);
  };
  process.once('SIGTERM', shutdown('SIGTERM'));
  process.once('SIGINT', shutdown('SIGINT'));
}

const simulator = new TelemetryGatewaySimulator();

start();