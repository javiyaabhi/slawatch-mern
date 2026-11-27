import mongoose from 'mongoose';
import { CATEGORIES, PRIORITIES, STATUSES } from '../domain/sla.js';
const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  category: { type: String, enum: CATEGORIES, required: true },
  priority: { type: String, enum: PRIORITIES, required: true },
  status: { type: String, enum: STATUSES, default: 'open' },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null, maxlength: 500 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slaTargetHours: { type: Number, required: true, min: 1 },
  slaDueAt: { type: Date, required: true },
  resolvedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null }
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ assignedTo: 1, status: 1, createdAt: -1 });
schema.index({ archivedAt: 1, createdAt: -1 });
schema.index({ assignedTo: 1, archivedAt: 1, createdAt: -1 });
schema.index({ status: 1, slaDueAt: 1 });
schema.index({ priority: 1, createdAt: -1 });
schema.index({ category: 1, createdAt: -1 });
export default mongoose.model('Ticket', schema);
