import mongoose from 'mongoose';
import { PRIORITIES } from '../domain/sla.js';
const schema = new mongoose.Schema({
  priority: { type: String, enum: PRIORITIES, required: true, unique: true },
  targetHours: { type: Number, required: true, min: 1, max: 720 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
export default mongoose.model('SlaPolicy', schema);
