const { auth } = require('./auth');
const requireRole = require('./requireRole');

/**
 * Access rule for the "Manage Wildlife Collar Boundary Alerts" surface.
 *
 * The dashboard is an Operations Officer / Park Manager tool, so every route it
 * reads from or writes to needs a real session and one of those two roles.
 * Hiding a menu item is not authorization: without this middleware any
 * anonymous caller could list every alert, read the audit trail, or acknowledge
 * and dispatch an incident.
 *
 * Villagers and rangers are refused (403) — they work in the mobile app, which
 * reaches the field-incident and conflict-report endpoints instead.
 */
const OPERATIONS_ROLES = ['officer', 'manager'];

const operationsAuth = [auth, requireRole(...OPERATIONS_ROLES)];

module.exports = { OPERATIONS_ROLES, operationsAuth };