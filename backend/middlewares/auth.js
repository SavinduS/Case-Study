const jwt = require('jsonwebtoken');
const config = require('../config');

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function toUser(payload) {
  return { id: payload.sub, role: payload.role };
}

// Required authentication: 401 when missing/invalid token
function auth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = toUser(jwt.verify(token, config.jwtSecret));
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Token-optional: anonymous stays null, valid token attaches req.user
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = toUser(jwt.verify(token, config.jwtSecret));
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = auth;
module.exports.auth = auth;
module.exports.optionalAuth = optionalAuth;
