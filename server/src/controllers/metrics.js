import Ticket from '../models/Ticket.js';
import TicketEvent from '../models/TicketEvent.js';
import { asyncHandler, HttpError } from '../middleware/http.js';
import { ticketScope } from '../services/tickets.js';
import { cohortStart, fillMonthlyCohorts, parseReportMonths, slaBreakdown, formatPriorityCompliance, formatAgeBuckets } from '../domain/reporting.js';
import { createReportCsv } from '../domain/exportCsv.js';

function monthlyAggregation(scope, start, now = new Date()) {
  return Ticket.aggregate([
    { $match: { ...scope, createdAt: { $gte: start, $lte: now } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } },
      count: { $sum: 1 },
      resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }
    } },
    { $sort: { _id: 1 } }
  ]);
}

export const overview = asyncHandler(async (req, res) => {
  const now = new Date();
  const scope = ticketScope(req.user);
  const [row, attention, monthlyRows] = await Promise.all([
    Ticket.aggregate([
      { $match: scope },
      { $group: {
        _id: null, total: { $sum: 1 },
        active: { $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        breached: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'resolved'] }, { $lt: ['$slaDueAt', now] }] }, 1, 0] } },
        atRisk: { $sum: { $cond: [{ $and: [
          { $ne: ['$status', 'resolved'] }, { $gte: ['$slaDueAt', now] },
          { $gte: [{ $subtract: [now, '$createdAt'] }, { $multiply: [{ $subtract: ['$slaDueAt', '$createdAt'] }, 0.8] }] }
        ] }, 1, 0] } },
        resolvedWithinSla: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'resolved'] }, { $lte: ['$resolvedAt', '$slaDueAt'] }] }, 1, 0] } },
        avgResolutionMs: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } }
      } }
    ]).then(rows => rows[0]),
    Ticket.find({ ...scope, status: { $ne: 'resolved' }, slaDueAt: { $lte: new Date(now.getTime() + 5 * 3600000) } })
      .populate('assignedTo', 'name').sort({ slaDueAt: 1 }).limit(6).lean(),
    monthlyAggregation(scope, cohortStart(6, now), now)
  ]);
  const counts = row || { total: 0, active: 0, resolved: 0, breached: 0, atRisk: 0, resolvedWithinSla: 0, avgResolutionMs: null };
  res.json({ counts: {
    total: counts.total, active: counts.active, resolved: counts.resolved, breached: counts.breached,
    atRisk: counts.atRisk, onTimeResolutionRate: counts.resolved ? Math.round(1000 * counts.resolvedWithinSla / counts.resolved) / 10 : null,
    avgResolutionHours: counts.avgResolutionMs == null ? null : Math.round(counts.avgResolutionMs / 360000) / 10
  }, attention, monthly: fillMonthlyCohorts(monthlyRows, 6, now) });
});


/** A single aggregation engine powers both JSON charts and CSV exports. */
export async function buildAnalyticsReport(user, months) {
  const now = new Date();
  const start = cohortStart(months, now);
  // Every analytics panel uses the same cohort of non-archived tickets opened in this window.
  const scope = { ...ticketScope(user), createdAt: { $gte: start, $lte: now } };
  const [monthlyRows, categories, priorities, agents, slowStages, slaRows, complianceRows, agingRows] = await Promise.all([
    monthlyAggregation(ticketScope(user), start, now),
    Ticket.aggregate([{ $match: scope }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Ticket.aggregate([{ $match: scope }, { $group: { _id: '$priority', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    user.role === 'manager' ? Ticket.aggregate([
      { $match: scope },
      { $group: { _id: '$assignedTo', total: { $sum: 1 }, active: { $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        avgResolutionMs: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } }
      } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', total: 1, active: 1, resolved: 1,
        avgResolutionHours: { $cond: [{ $ne: ['$avgResolutionMs', null] }, { $round: [{ $divide: ['$avgResolutionMs', 3600000] }, 1] }, null] }
      } }, { $sort: { active: -1 } }
    ]) : Promise.resolve([]),
    TicketEvent.aggregate([
      { $match: { kind: 'status_changed', durationInPreviousStatusMs: { $ne: null } } },
      { $lookup: { from: 'tickets', localField: 'ticketId', foreignField: '_id', as: 'ticket' } },
      { $unwind: '$ticket' },
      { $match: { 'ticket.archivedAt': null, 'ticket.createdAt': { $gte: start, $lte: now },
        ...(user.role === 'manager' ? {} : { 'ticket.assignedTo': user._id }) } },
      { $group: { _id: '$fromStatus', count: { $sum: 1 }, avgHours: { $avg: { $divide: ['$durationInPreviousStatusMs', 3600000] } } } },
      { $project: { count: 1, avgHours: { $round: ['$avgHours', 1] } } }
    ]),
    Ticket.aggregate([
      { $match: scope },
      { $group: { _id: null,
        resolvedMet: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'resolved'] }, { $lte: ['$resolvedAt', '$slaDueAt'] }] }, 1, 0] } },
        resolvedLate: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'resolved'] }, { $gt: ['$resolvedAt', '$slaDueAt'] }] }, 1, 0] } },
        breached: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'resolved'] }, { $lt: ['$slaDueAt', now] }] }, 1, 0] } },
        atRisk: { $sum: { $cond: [{ $and: [
          { $ne: ['$status', 'resolved'] }, { $gte: ['$slaDueAt', now] },
          { $gte: [{ $subtract: [now, '$createdAt'] }, { $multiply: [{ $subtract: ['$slaDueAt', '$createdAt'] }, 0.8] }] }
        ] }, 1, 0] } },
        onTrack: { $sum: { $cond: [{ $and: [
          { $ne: ['$status', 'resolved'] }, { $gte: ['$slaDueAt', now] },
          { $lt: [{ $subtract: [now, '$createdAt'] }, { $multiply: [{ $subtract: ['$slaDueAt', '$createdAt'] }, 0.8] }] }
        ] }, 1, 0] } }
      } }
    ]).then(rows => rows[0] || {}),
    Ticket.aggregate([
      { $match: scope },
      { $group: { _id: '$priority',
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        onTime: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'resolved'] }, { $lte: ['$resolvedAt', '$slaDueAt'] }] }, 1, 0] } }
      } }
    ]),
    Ticket.aggregate([
      { $match: { ...scope, status: { $ne: 'resolved' } } },
      { $project: { ageBucket: { $switch: { branches: [
        { case: { $gte: ['$createdAt', new Date(now.getTime() - 4 * 3600000)] }, then: 'under4' },
        { case: { $gte: ['$createdAt', new Date(now.getTime() - 24 * 3600000)] }, then: '4to24' },
        { case: { $gte: ['$createdAt', new Date(now.getTime() - 72 * 3600000)] }, then: '1to3days' }
      ], default: 'over3days' } } } },
      { $group: { _id: '$ageBucket', count: { $sum: 1 } } }
    ])
  ]);
  return { period: { months, from: start.toISOString(), through: now.toISOString() },
    monthly: fillMonthlyCohorts(monthlyRows, months, now), categories, priorities,
    slaBreakdown: slaBreakdown(slaRows), priorityCompliance: formatPriorityCompliance(complianceRows),
    aging: formatAgeBuckets(agingRows), agents, slowStages };
}

function reportPeriod(req) {
  try { return parseReportMonths(req.query.months); }
  catch { throw new HttpError(400, 'Report period must be 3, 6, or 12 months'); }
}
export const analytics = asyncHandler(async (req, res) => {
  res.json(await buildAnalyticsReport(req.user, reportPeriod(req)));
});
export const exportAnalytics = asyncHandler(async (req, res) => {
  const report = await buildAnalyticsReport(req.user, reportPeriod(req));
  const filename = `slawatch-report-${report.period.through.slice(0, 10)}-${report.period.months}m.csv`;
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(createReportCsv(report));
});
