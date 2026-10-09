const app = require('./app');
const config = require('./config');
const connectDB = require('./config/db');
const TelemetryGatewaySimulator = require('./services/telemetrySimulator');

connectDB().catch(console.error);

// Listen on the configured port (5000 by default); if it is already busy,
// retry once on the next port (5001) — the mobile client probes both.
function listen(port, allowRetry = true) {
  const server = app.listen(port, () => {
    console.log(`API on :${port}`);

    // The physical collars and their gateway are not available in this
    // deployment, so the server generates telemetry itself. The browser only
    // ever reads the database. Disable with TELEMETRY_SIMULATOR=false.
    if (process.env.TELEMETRY_SIMULATOR !== 'false') {
      new TelemetryGatewaySimulator().start();
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
}

listen(config.port);