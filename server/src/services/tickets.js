import mongoose from 'mongoose';
import crypto from 'node:crypto';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import TicketEvent from '../models/TicketEvent.js';
import SlaPolicy from '../models/SlaPolicy.js';
import { DEFAULT_HOURS, canChangeStatus, slaDeadline } from '../domain/sla.js';
import { HttpError } from '../middleware/http.js';
import { mayReadTicket, mayEditTicketFields, mayArchiveTicket, ticketScope } from '../domain/permissions.js';

export { ticketScope };
export function requireTicketAccess(ticket, user, { allowArchived = false } = {}) {
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  if (!mayReadTicket(ticket, user, { allowArchived })) throw new HttpError(403, 'Ticket is not available to you');
}
async function assertAgent(id, session) {
  const user = await User.findOne({ _id: id, role: 'agent', active: true }).session(session);
  if (!user) throw new HttpError(400, 'Select an active support agent');
}
async function policyHours(priority, session) {
  const policy = await SlaPolicy.findOne({ priority }).session(session);
  return policy?.targetHours ?? DEFAULT_HOURS[priority];
}
export async function createTicket(input, user) {
  let created;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const assignedTo = user.role === 'agent' ? user._id : input.assignedTo;
      if (!assignedTo) throw new HttpError(400, 'Assign this ticket to a support agent');
      await assertAgent(assignedTo, session);
      const now = new Date();
      const targetHours = await policyHours(input.priority, session);
      const code = `SW-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      [created] = await Ticket.create([{ ...input, code, assignedTo, createdBy: user._id, status: 'open', slaTargetHours: targetHours, slaDueAt: slaDeadline(now, targetHours), createdAt: now }], { session });
      await TicketEvent.create([{ ticketId: created._id, actorId: user._id, kind: 'created', toStatus: 'open', detail: 'Ticket opened' }], { session });
    });
    return created;
  } finally { await session.endSession(); }
}
export async function changeTicket(ticketId, input, user) {
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const ticket = await Ticket.findById(ticketId).session(session);
      requireTicketAccess(ticket, user);
      if (ticket.status === 'resolved') throw new HttpError(409, 'Resolved tickets are locked');
      if (!mayEditTicketFields(user, input)) throw new HttpError(403, 'Agents can only update status');
      if (input.status && !canChangeStatus(ticket.status, input.status)) throw new HttpError(409, 'Invalid status transition');
      if (input.assignedTo) await assertAgent(input.assignedTo, session);
      const now = new Date();
      const patch = { ...input };
      if (input.priority && input.priority !== ticket.priority) {
        patch.slaTargetHours = await policyHours(input.priority, session);
        patch.slaDueAt = slaDeadline(ticket.createdAt, patch.slaTargetHours);
      }
      const changedStatus = input.status && input.status !== ticket.status;
      if (changedStatus && input.status === 'resolved') patch.resolvedAt = now;
      const keysChanged = Object.keys(patch).filter(k => String(ticket[k]) !== String(patch[k]));
      if (!keysChanged.length) { result = ticket; return; }
      result = await Ticket.findOneAndUpdate({ _id: ticket._id, __v: ticket.__v }, { $set: patch, $inc: { __v: 1 } }, { session, new: true, runValidators: true });
      if (!result) throw new HttpError(409, 'Ticket changed. Refresh and retry.');
      let durationInPreviousStatusMs = null;
      if (changedStatus) {
        const previous = await TicketEvent.findOne({ ticketId: ticket._id, kind: { $in: ['created', 'status_changed'] } }).sort({ createdAt: -1 }).session(session);
        durationInPreviousStatusMs = Math.max(0, now.getTime() - new Date(previous?.createdAt || ticket.createdAt).getTime());
      }
      await TicketEvent.create([{
        ticketId: ticket._id, actorId: user._id,
        kind: changedStatus ? 'status_changed' : 'updated',
        fromStatus: changedStatus ? ticket.status : null,
        toStatus: changedStatus ? input.status : null,
        durationInPreviousStatusMs,
        detail: changedStatus ? `Status changed: ${ticket.status.replace('_', ' ')} → ${input.status.replace('_', ' ')}` : `Updated ${keysChanged.filter(k => !['slaTargetHours', 'slaDueAt'].includes(k)).join(', ')}`,
        createdAt: now
      }], { session });
    });
    return result;
  } finally { await session.endSession(); }
}

export async function archiveTicket(ticketId, user) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const ticket = await Ticket.findById(ticketId).session(session);
      if (!ticket) throw new HttpError(404, 'Ticket not found');
      if (!mayArchiveTicket(ticket, user)) throw new HttpError(409, 'Only a manager can archive a resolved ticket');
      const updated = await Ticket.findOneAndUpdate(
        { _id: ticket._id, __v: ticket.__v, archivedAt: null },
        { $set: { archivedAt: new Date() }, $inc: { __v: 1 } },
        { new: true, session }
      );
      if (!updated) throw new HttpError(409, 'Ticket changed. Refresh and retry.');
      await TicketEvent.create([{
        ticketId: ticket._id, actorId: user._id, kind: 'archived',
        detail: 'Resolved ticket archived by manager'
      }], { session });
    });
  } finally { await session.endSession(); }
}
