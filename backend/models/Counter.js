const mongoose = require('mongoose');

/**
 * Atomic named sequence, used for the alert reference ID.
 *
 * `countDocuments()` + 1 is not safe: two concurrent telemetry ingests read
 * the same count and try to create the same alertId, which fails with a
 * duplicate key error. findOneAndUpdate with $inc is atomic in MongoDB.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

/** Returns the next value of a named sequence, starting at 1. */
async function nextSequence(name) {
  const doc = await mongoose.model('Counter').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

module.exports = mongoose.model('Counter', counterSchema);
module.exports.nextSequence = nextSequence;