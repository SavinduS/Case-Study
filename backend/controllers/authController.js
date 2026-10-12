const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

const ROLES = ['villager', 'ranger', 'officer', 'manager'];

// Deliberately permissive: the goal is to catch typos such as "nimali@" or
// "name.example.com", not to argue with RFC 5322.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function signToken(user) {
  // `name` travels with the token so the wildlife monitoring audit trail can
  // record which officer acted without a second lookup on every write.
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

// The mobile client renders the signed-in user's name, role and contact
// details straight after login, so they travel with the token instead of
// costing a second request.
function sessionPayload(user, token) {
  return {
    id: user._id,
    name: user.name,
    role: user.role,
    phone: user.phone,
    email: user.email,
    token
  };
}

// Emails are matched case-insensitively (the schema lowercases on write).
function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function handleRegister(req, res, next, { forceVillager }) {
  try {
    const { name, phone, password } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'name, phone and password are required' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'password must be at least 6 characters' });
    }
    // The public villager sign-up can never choose a role; the seeded/admin
    // register still may.
    const role = forceVillager ? 'villager' : req.body.role || 'villager';
    if (!forceVillager && req.body.role && !ROLES.includes(req.body.role)) {
      return res.status(400).json({ message: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (req.body.email && !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: 'email is not a valid address' });
    }
    const exists = await User.findOne({ phone });
    if (exists) return res.status(409).json({ message: 'Phone already registered' });
    if (email) {
      const emailTaken = await User.findOne({ email });
      if (emailTaken) return res.status(409).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      phone,
      email: email || undefined,
      passwordHash,
      role
    });
    res.status(201).json(sessionPayload(user, signToken(user)));
  } catch (e) { next(e); }
}

async function register(req, res, next) {
  await handleRegister(req, res, next, { forceVillager: false });
}

// Public sign-up for villagers from the mobile app. Always creates a villager
// no matter what role the request body claims.
async function registerVillager(req, res, next) {
  await handleRegister(req, res, next, { forceVillager: true });
}

async function login(req, res, next) {
  try {
    // One field that is either an email address or a phone number. `phone` is
    // still accepted so existing clients and scripts keep working.
    const identifier = String(
      req.body.identifier || req.body.email || req.body.phone || ''
    ).trim();
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'email or phone and password are required' });
    }
    const user = await User.findOne({
      $or: [{ phone: identifier }, { email: normalizeEmail(identifier) }]
    });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    res.json(sessionPayload(user, signToken(user)));
  } catch (e) { next(e); }
}

// Restores a session on app start: the phone kept the token from the previous
// login, so prove it is still valid and hand back the current user. A deleted
// user is reported as 401 so the client signs out instead of trusting a role
// that no longer exists.
async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    res.json({
      id: user._id,
      name: user.name,
      role: user.role,
      phone: user.phone,
      email: user.email
    });
  } catch (e) { next(e); }
}

module.exports = { register, registerVillager, login, me };