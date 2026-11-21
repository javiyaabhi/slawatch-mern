import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['created', 'updated', 'status_changed', 'archived'], required: true },
  fromStatus: { type: String, default: null },
  toStatus: { type: String, default: null },
  durationInPreviousStatusMs: { type: Number, default: null },
  detail: { type: String, maxlength: 400, required: true }
}, { timestamps: true });
schema.index({ ticketId: 1, createdAt: 1 });
schema.index({ fromStatus: 1, createdAt: -1 });
export default mongoose.model('TicketEvent', schema);
