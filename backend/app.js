const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Dev visibility: log every request so you can confirm the phone is reaching
// this machine (skipped during tests)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode}`));
    next();
  });
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/conflict-reports', require('./routes/conflictReports'));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

module.exports = app;
