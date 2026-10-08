const User = require('../models/User');

// POST /api/auth/register, POST /api/auth/login (sample logic)
async function register(req, res, next) {
  try {
    const { name, phone, role } = req.body;
    const exists = await User.findOne({ phone });
    if (exists) return res.status(409).json({ message: 'Phone already registered' });
    const user = await User.create({ name, phone, passwordHash: 'TODO-hash', role });
    res.status(201).json({ id: user._id, role: user.role });
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ id: user._id, role: user.role, token: 'TODO-jwt' });
  } catch (e) { next(e); }
}

module.exports = { register, login };
