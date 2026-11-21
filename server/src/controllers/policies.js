import mongoose from 'mongoose';
import { z } from 'zod';
import SlaPolicy from '../models/SlaPolicy.js';
import PolicyChange from '../models/PolicyChange.js';
import { DEFAULT_HOURS, PRIORITIES } from '../domain/sla.js';
import { asyncHandler, HttpError } from '../middleware/http.js';

export const policySchema = z.object({ targetHours: z.number().int().min(1).max(720) }).strict();
export const policies = asyncHandler(async (_req, res) => {
  const stored = await SlaPolicy.find().lean();
  const all = PRIORITIES.map(priority => ({
    priority,
    targetHours: stored.find(item => item.priority === priority)?.targetHours ?? DEFAULT_HOURS[priority]
  }));
  res.json({ policies: all });
});

/** Transactions ensure that updating an SLA policy cannot silently lose its audit trail. */
export const updatePolicy = asyncHandler(async (req, res) => {
  const { priority } = req.params;
  if (!PRIORITIES.includes(priority)) throw new HttpError(400, 'Invalid priority');
  const targetHours = req.validated.targetHours;
  const session = await mongoose.startSession();
  let policy, changed = false;
  try {
    await session.withTransaction(async () => {
      const existing = await SlaPolicy.findOne({ priority }).session(session);
      const previousHours = existing?.targetHours ?? DEFAULT_HOURS[priority];
      if (targetHours === previousHours) {
        policy = existing || { priority, targetHours }; // no-op: do not write a misleading audit event
        return;
      }
      if (existing) {
        // Update within the same transaction as the append-only audit record.
        policy = await SlaPolicy.findOneAndUpdate(
          { _id: existing._id },
          { $set: { targetHours, updatedBy: req.user._id } },
          { session, new: true, runValidators: true }
        );
      } else {
        [policy] = await SlaPolicy.create([{ priority, targetHours, updatedBy: req.user._id }], { session });
      }
      await PolicyChange.create([{ priority, previousHours, newHours: targetHours, actorId: req.user._id }], { session });
      changed = true;
    });
  } finally { await session.endSession(); }
  res.json({ policy, changed });
});

export const policyHistory = asyncHandler(async (_req, res) => {
  const changes = await PolicyChange.find({}).sort({ createdAt: -1, _id: -1 }).limit(30)
    .populate('actorId', 'name').lean();
  res.json({ changes });
});
