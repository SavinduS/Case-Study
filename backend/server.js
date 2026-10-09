const express = require('express');
const path = require('path');
const config = require('./config');
const connectDB = require('./config/db');

const app = express();
app.use(express.json());

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

connectDB().catch(console.error);
app.listen(config.port, () => console.log(`API on :${config.port}`));
