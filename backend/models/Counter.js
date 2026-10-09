const mongoose = require('mongoose');

/**
 * Atomic named sequence, shared by every generated reference ID
 * (CR- conflict report numbers, CBA- boundary alert numbers).
 *
 * `countDocuments()` + 1 is not safe: two concurrent writes read the same
 * count and try to create the same ID, which fails with a duplicate key
 * error. findOneAndUpdate with $inc is atomic in MongoDB.
 */
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

/** Returns the next value of a named sequence, starting at 1. */
async function nextSequence(name) {
  const counter = await mongoose
    .model('Counter')
    .findOneAndUpdate({ key: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return counter.seq;
}

module.exports = mongoose.model('Counter', counterSchema);
module.exports.nextSequence = nextSequence;