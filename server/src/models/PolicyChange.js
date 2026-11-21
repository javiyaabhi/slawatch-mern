import mongoose from 'mongoose';

/** Append-only audit record for policy changes; never edited or deleted by application routes. */
const schema = new mongoose.Schema({
  priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
  previousHours: { type: Number, required: true, min: 1 },
  newHours: { type: Number, required: true, min: 1 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ createdAt: -1, _id: -1 });
export default mongoose.model('PolicyChange', schema);
