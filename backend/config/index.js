const path = require('path');
const dotenv = require('dotenv');

// dotenv resolves `.env` against process.cwd() by default, so running the
// server from the repo root instead of backend/ silently loads a *different*
// file. The repo has one .env per package and their JWT secrets differ, so
// that produced tokens signed with one secret and verified with another —
// intermittent 401s depending on the working directory. Point it at the file
// next to this module so the config is identical from any cwd.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const port = Number(process.env.PORT || 5000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wildlife';
const jwtSecret = process.env.JWT_SECRET || 'change-me';

// A default secret silently turns a misconfigured deployment into one where
// anyone who read the source can mint valid tokens. Fail loudly instead.
if (process.env.NODE_ENV === 'production' && jwtSecret === 'change-me') {
  throw new Error('JWT_SECRET must be set to a real secret in production');
}

module.exports = {
  port,
  mongoUri,
  jwtSecret,
  isProduction: process.env.NODE_ENV === 'production'
};
