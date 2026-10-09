const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

const ROLES = ['villager', 'ranger', 'officer', 'manager'];

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, { expiresIn: '7d' });
}

async function register(req, res, next) {
  try {
    const { name, phone, password, role } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'name, phone and password are required' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'password must be at least 6 characters' });
    }
    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ message: `role must be one of: ${ROLES.join(', ')}` });
    }
    const exists = await User.findOne({ phone });
    if (exists) return res.status(409).json({ message: 'Phone already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, phone, passwordHash, role: role || 'villager' });
    res.status(201).json({ id: user._id, role: user.role, token: signToken(user) });
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'phone and password are required' });
    }
    const user = await User.findOne({ phone });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ id: user._id, role: user.role, token: signToken(user) });
  } catch (e) { next(e); }
}

module.exports = { register, login };
