import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, trim: true, minlength: 2, maxlength: 80, required: true },
  email: { type: String, trim: true, lowercase: true, unique: true, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['manager', 'agent'], default: 'agent' },
  active: { type: Boolean, default: true }
}, { timestamps: true });
schema.set('toJSON', { transform: (_doc, ret) => { delete ret.passwordHash; delete ret.__v; return ret; } });
export default mongoose.model('User', schema);
