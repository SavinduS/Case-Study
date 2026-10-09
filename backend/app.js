const express = require('express');
const path = require('path');
const { isConnected } = require('./config/db');

const app = express();
app.use(express.json());

// JSON APIs gain nothing from ETags — and conditional revalidation makes
// healthy clients see 304s, which the mobile app's reachability probe
// (res.ok) misreads as "server down". Disable them entirely.
app.set('etag', false);

// Dev visibility (skipped during tests). Logs three moments so you can tell
// apart "request never arrived" / "server responded" / "client gave up":
//   > POST /api/conflict-reports          arrival
//   < POST /api/conflict-reports -> 201 (45ms)
//   x POST /api/conflict-reports aborted after 20001ms (client never got a response)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    console.log(`> ${req.method} ${req.originalUrl}`);
    res.on('finish', () => {
      console.log(`< ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    res.on('close', () => {
      if (!res.writableEnded) {
        console.log(`x ${req.method} ${req.originalUrl} aborted after ${Date.now() - start}ms`);
      }
    });
    next();
  });
}

// Liveness only: proves this process is up and speaking HTTP. The mobile
// client uses it to find which port the API is on, and a database outage must
// not make it hunt for a different port — the port is still correct. Readiness
// (database included) is /health/ready below.
app.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true });
});

// Readiness: the database is what every other endpoint depends on, so this is
// what a load balancer or an operator should poll.
app.get('/health/ready', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const ready = isConnected();
  res.status(ready ? 200 : 503).json({ ok: ready, database: ready ? 'connected' : 'disconnected' });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Fail fast instead of letting queries queue in the mongoose buffer. Without
// this a request that arrives while Atlas is reconnecting waits the full
// bufferTimeoutMS and then fails anyway; the mobile client has already given up
// by then, so the report is lost with only a timeout in the logs.
app.use('/api', (req, res, next) => {
  if (isConnected()) return next();
  res.status(503).json({ message: 'Database unavailable. Please retry.' });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/conflict-reports', require('./routes/conflictReports'));

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

module.exports = app;
