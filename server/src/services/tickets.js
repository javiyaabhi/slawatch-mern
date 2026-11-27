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
  const query = User.findOne({ _id: id, role: 'agent', active: true });
  if (session) query.session(session);
  const user = await query;
  if (!user) throw new HttpError(400, 'Select an active support agent');
}
async function policyHours(priority, session) {
  const query = SlaPolicy.findOne({ priority });
  if (session) query.session(session);
  const policy = await query;
  return policy?.targetHours ?? DEFAULT_HOURS[priority];
}

async function executeTransaction(action) {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await action(session);
      });
      return result;
    } catch (err) {
      if (err.message && err.message.includes('Transaction numbers are only allowed on a replica set member or mongos')) {
        return await action(null);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
}

export async function createTicket(input, user) {
  return executeTransaction(async (session) => {
    const isAgent = user.role === 'agent';
    const assignedTo = isAgent ? user._id : input.assignedTo;
    if (!assignedTo) throw new HttpError(400, 'Assign this ticket to a support agent');
    await assertAgent(assignedTo, session);
    const now = new Date();
    const targetHours = await policyHours(input.priority, session);
    const code = `SW-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const approvalStatus = isAgent ? 'pending' : 'approved';
    const approvedBy = isAgent ? null : user._id;
    const approvedAt = isAgent ? null : now;
    const opts = session ? { session } : {};
    const [created] = await Ticket.create([{
      ...input,
      code,
      assignedTo,
      createdBy: user._id,
      status: 'open',
      approvalStatus,
      approvedBy,
      approvedAt,
      slaTargetHours: targetHours,
      slaDueAt: slaDeadline(now, targetHours),
      createdAt: now
    }], opts);
    const detail = isAgent ? 'Ticket raised by agent (pending manager approval)' : 'Ticket opened';
    await TicketEvent.create([{ ticketId: created._id, actorId: user._id, kind: 'created', toStatus: 'open', detail }], opts);
    return created;
  });
}
export async function changeTicket(ticketId, input, user) {
  return executeTransaction(async (session) => {
    const opts = session ? { session } : {};
    const query = Ticket.findById(ticketId);
    if (session) query.session(session);
    const ticket = await query;
    requireTicketAccess(ticket, user);
    if (ticket.status === 'resolved') throw new HttpError(409, 'Resolved tickets are locked');
    if (!mayEditTicketFields(user, input)) throw new HttpError(403, 'Agents can only update status');
    if (input.status) {
      if (ticket.approvalStatus === 'pending' && input.approvalStatus !== 'approved') {
        throw new HttpError(403, 'Ticket must be approved by a manager before work can begin');
      }
      if (ticket.approvalStatus === 'rejected') {
        throw new HttpError(403, 'Cannot update a rejected ticket');
      }
      if (!canChangeStatus(ticket.status, input.status)) throw new HttpError(409, 'Invalid status transition');
    }
    if (input.assignedTo) await assertAgent(input.assignedTo, session);
    const now = new Date();
    const patch = { ...input };
    if (input.approvalStatus) {
      if (user.role !== 'manager') throw new HttpError(403, 'Only managers can approve or reject tickets');
      if (input.approvalStatus === 'approved') {
        patch.approvedBy = user._id;
        patch.approvedAt = now;
        patch.rejectionReason = null;
      } else if (input.approvalStatus === 'rejected') {
        patch.rejectionReason = input.rejectionReason || 'Rejected by manager';
      }
    }
    if (input.priority && input.priority !== ticket.priority) {
      patch.slaTargetHours = await policyHours(input.priority, session);
      patch.slaDueAt = slaDeadline(ticket.createdAt, patch.slaTargetHours);
    }
    const changedStatus = input.status && input.status !== ticket.status;
    if (changedStatus && input.status === 'resolved') patch.resolvedAt = now;
    const keysChanged = Object.keys(patch).filter(k => String(ticket[k]) !== String(patch[k]));
    if (!keysChanged.length) return ticket;
    const result = await Ticket.findOneAndUpdate({ _id: ticket._id, __v: ticket.__v }, { $set: patch, $inc: { __v: 1 } }, { ...opts, new: true, runValidators: true });
    if (!result) throw new HttpError(409, 'Ticket changed. Refresh and retry.');
    let durationInPreviousStatusMs = null;
    if (changedStatus) {
      const prevQuery = TicketEvent.findOne({ ticketId: ticket._id, kind: { $in: ['created', 'status_changed'] } }).sort({ createdAt: -1 });
      if (session) prevQuery.session(session);
      const previous = await prevQuery;
      durationInPreviousStatusMs = Math.max(0, now.getTime() - new Date(previous?.createdAt || ticket.createdAt).getTime());
    }
    let eventKind = changedStatus ? 'status_changed' : 'updated';
    let eventDetail = changedStatus ? `Status changed: ${ticket.status.replace('_', ' ')} → ${input.status.replace('_', ' ')}` : `Updated ${keysChanged.filter(k => !['slaTargetHours', 'slaDueAt', 'approvedBy', 'approvedAt'].includes(k)).join(', ')}`;
    if (input.approvalStatus === 'approved' && ticket.approvalStatus !== 'approved') {
      eventKind = 'approved';
      eventDetail = `Ticket approved by manager`;
    } else if (input.approvalStatus === 'rejected' && ticket.approvalStatus !== 'rejected') {
      eventKind = 'rejected';
      eventDetail = `Ticket rejected: ${input.rejectionReason || 'Rejected by manager'}`;
    }
    await TicketEvent.create([{
      ticketId: ticket._id, actorId: user._id,
      kind: eventKind,
      fromStatus: changedStatus ? ticket.status : null,
      toStatus: changedStatus ? input.status : null,
      durationInPreviousStatusMs,
      detail: eventDetail,
      createdAt: now
    }], opts);
    return result;
  });
}

export async function archiveTicket(ticketId, user) {
  return executeTransaction(async (session) => {
    const opts = session ? { session } : {};
    const query = Ticket.findById(ticketId);
    if (session) query.session(session);
    const ticket = await query;
    if (!ticket) throw new HttpError(404, 'Ticket not found');
    if (!mayArchiveTicket(ticket, user)) throw new HttpError(409, 'Only a manager can archive a resolved ticket');
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, __v: ticket.__v, archivedAt: null },
      { $set: { archivedAt: new Date() }, $inc: { __v: 1 } },
      { new: true, ...opts }
    );
    if (!updated) throw new HttpError(409, 'Ticket changed. Refresh and retry.');
    await TicketEvent.create([{
      ticketId: ticket._id, actorId: user._id, kind: 'archived',
      detail: 'Resolved ticket archived by manager'
    }], opts);
    return { ok: true };
  });
}
