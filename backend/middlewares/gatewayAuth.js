const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const requireRole = require('../middlewares/requireRole');

/**
 * Authentication for the collar telemetry gateway endpoints
 * (`POST /api/telemetry/fixes`, `PUT /api/telemetry/collars/:id/signal`).
 *
 * These are called by the IoT gateway / satellite link, not by a signed-in
 * person, so they cannot use the JWT session guard on their own. The project's
 * data model carries no device credential, so this reads an optional shared
 * secret from `TELEMETRY_GATEWAY_TOKEN` and accepts either credential:
 *
 *   - secret unset -> the endpoint stays open, so the bundled telemetry
 *     simulator and a local gateway post fixes with no extra configuration.
 *     Recorded in the README as a known limitation.
 *   - secret set   -> `X-Gateway-Token` must match (timing-safe compare), or the
 *     caller must present a valid officer/manager session token. Anything else
 *     is refused with 401, so a stolen/expired session cannot push fixes.
 */
function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hasValidGatewayToken(req, expected) {
  const supplied = req.get('x-gateway-token') || '';
  return Boolean(supplied) && timingSafeEquals(supplied, expected);
}

function hasValidSession(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    return payload && Boolean(payload.sub) && Boolean(payload.role);
  } catch {
    return false;
  }
}

/** True when the gateway secret is switched on, so a bad token is worth 401. */
function gatewaySecretConfigured() {
  return Boolean(process.env.TELEMETRY_GATEWAY_TOKEN);
}

function gatewayAuth(req, res, next) {
  if (!gatewaySecretConfigured()) return next();
  if (hasValidGatewayToken(req, process.env.TELEMETRY_GATEWAY_TOKEN)) return next();
  if (hasValidSession(req)) return next();
  return res.status(401).json({ message: 'Invalid or missing gateway token' });
}

/**
 * Operator session guard for a gateway route, used only when a gateway secret is
 * configured and the request did not already carry one.
 */
function operatorFallback(req, res, next) {
  if (!gatewaySecretConfigured() || hasValidGatewayToken(req, process.env.TELEMETRY_GATEWAY_TOKEN)) {
    return next();
  }
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No gateway token or session' });
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  req.user = { id: payload.sub, role: payload.role };
  return requireRole('officer', 'manager')(req, res, next);
}

module.exports = gatewayAuth;
module.exports.gatewayAuth = gatewayAuth;
module.exports.operatorFallback = operatorFallback;
module.exports.gatewaySecretConfigured = gatewaySecretConfigured;