const express = require('express');
const config = require('./config');
const connectDB = require('./config/db');
const TelemetryGatewaySimulator = require('./services/telemetrySimulator');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Existing modules from the other use cases.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/incidents', require('./routes/incidents'));

// Manage Wildlife Collar Boundary Alerts.
app.use('/api/collars', require('./routes/collars'));
app.use('/api/geofences', require('./routes/geofences'));
app.use('/api/parks', require('./routes/parks'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/telemetry', require('./routes/telemetry'));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Domain errors carry a statusCode; everything else is a genuine 500.
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: err.message || 'Server error' });
});

async function start() {
  await connectDB();
  app.listen(config.port, () => console.log(`API on :${config.port}`));

  // The physical collars and their gateway are not available in this
  // deployment, so the server generates telemetry itself. The browser only
  // ever reads the database. Disable with TELEMETRY_SIMULATOR=false.
  if (process.env.TELEMETRY_SIMULATOR !== 'false') {
    new TelemetryGatewaySimulator().start();
    console.log('Telemetry gateway simulator started');
  }
}

start().catch(console.error);