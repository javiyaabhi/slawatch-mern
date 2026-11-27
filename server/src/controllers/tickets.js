import mongoose from 'mongoose';
import { z } from 'zod';
import Ticket from '../models/Ticket.js';
import TicketEvent from '../models/TicketEvent.js';
import { CATEGORIES, PRIORITIES, STATUSES } from '../domain/sla.js';
import { parseTicketPage } from '../domain/pagination.js';
import { mayViewArchive } from '../domain/permissions.js';
import { asyncHandler, HttpError } from '../middleware/http.js';
import { changeTicket, createTicket, archiveTicket, requireTicketAccess, ticketScope } from '../services/tickets.js';

const objectId = z.string().regex(/^[a-fA-F\d]{24}$/, 'Invalid user identifier');
export const newTicketSchema = z.object({
  title: z.string().trim().min(5).max(150), description: z.string().trim().min(10).max(3000),
  category: z.enum(CATEGORIES), priority: z.enum(PRIORITIES), assignedTo: objectId.optional()
}).strict();
export const updateTicketSchema = z.object({
  title: z.string().trim().min(5).max(150).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  category: z.enum(CATEGORIES).optional(), priority: z.enum(PRIORITIES).optional(),
  assignedTo: objectId.optional(), status: z.enum(STATUSES).optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  rejectionReason: z.string().trim().max(500).optional()
}).strict().refine(v => Object.keys(v).length > 0, 'Provide a change');

export const listTickets = asyncHandler(async (req, res) => {
  const { status, priority, category, q = '', archived = '0', approval } = req.query;
  if (!['0', '1'].includes(archived)) throw new HttpError(400, 'Invalid archive filter');
  const archivedOnly = archived === '1';
  if (archivedOnly && !mayViewArchive(req.user)) throw new HttpError(403, 'Manager access required');
  if (status && !STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
  if (priority && !PRIORITIES.includes(priority)) throw new HttpError(400, 'Invalid priority');
  if (category && !CATEGORIES.includes(category)) throw new HttpError(400, 'Invalid category');
  if (approval && !['pending', 'approved', 'rejected'].includes(approval)) throw new HttpError(400, 'Invalid approval filter');
  const query = { ...ticketScope(req.user, { archivedOnly }) };
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (approval) query.approvalStatus = approval;
  if (q) {
    if (typeof q !== 'string' || q.length > 80) throw new HttpError(400, 'Search term too long');
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ title: { $regex: escaped, $options: 'i' } }, { code: { $regex: escaped, $options: 'i' } }];
  }
  let page;
  try { page = parseTicketPage(req.query.page); }
  catch { throw new HttpError(400, 'Invalid page number'); }
  const limit = 15;
  const [tickets, total] = await Promise.all([
    Ticket.find(query).populate('assignedTo', 'name email').populate('createdBy', 'name email').populate('approvedBy', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Ticket.countDocuments(query)
  ]);
  res.json({ tickets, total, page, pages: Math.ceil(total / limit), archived: archivedOnly });
});
export const getTicket = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid ticket ID');
  const ticket = await Ticket.findById(req.params.id).lean();
  requireTicketAccess(ticket, req.user, { allowArchived: true });
  const [events, populated] = await Promise.all([
    TicketEvent.find({ ticketId: ticket._id }).sort({ createdAt: 1 }).populate('actorId', 'name').lean(),
    Ticket.findById(ticket._id).populate('assignedTo', 'name email').populate('createdBy', 'name email').populate('approvedBy', 'name email').lean()
  ]);
  res.json({ ticket: populated, events });
});
export const postTicket = asyncHandler(async (req, res) => {
  const ticket = await createTicket(req.validated, req.user);
  res.status(201).json({ ticket });
});
export const patchTicket = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid ticket ID');
  const ticket = await changeTicket(req.params.id, req.validated, req.user);
  res.json({ ticket });
});

export const archiveResolvedTicket = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid ticket ID');
  await archiveTicket(req.params.id, req.user);
  res.json({ message: 'Ticket archived, with its audit history retained.' });
});
