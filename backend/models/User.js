const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  // Optional: a user may sign in with either the phone number or the email.
  // Sparse so the many users without an email are not treated as duplicates
  // of each other by the unique index.
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['villager', 'ranger', 'officer', 'manager'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);