import mongoose from 'mongoose';

/** Server-side session registry enables immediate logout/revocation of JWT cookies. */
const schema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, immutable: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

export default mongoose.model('UserSession', schema);
