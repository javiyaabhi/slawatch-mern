/** Report windows are calendar-month cohorts in UTC, including the current month. */
export const REPORT_MONTHS = Object.freeze([3, 6, 12]);

export function parseReportMonths(raw) {
  const value = raw === undefined ? 6 : Number(raw);
  if (!REPORT_MONTHS.includes(value) || (raw !== undefined && String(value) !== String(raw))) {
    throw new Error('Report period must be 3, 6, or 12 months');
  }
  return value;
}

export function cohortStart(months, now = new Date()) {
  if (!REPORT_MONTHS.includes(months)) throw new Error('Invalid report period');
  const current = new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('Invalid current date');
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - months + 1, 1));
}

export function fillMonthlyCohorts(rows, months, now = new Date()) {
  const start = cohortStart(months, now);
  const mapped = new Map(rows.map(row => [row._id, row]));
  return Array.from({ length: months }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)).toISOString().slice(0, 7);
    const row = mapped.get(month);
    return { month, opened: row?.count || 0, resolved: row?.resolved || 0 };
  });
}

/** SLA breakdown always partitions the cohort, including unresolved tickets. */
export function slaBreakdown(summary = {}) {
  return [
    { key: 'met', label: 'Resolved on time', count: summary.resolvedMet || 0 },
    { key: 'resolvedLate', label: 'Resolved late', count: summary.resolvedLate || 0 },
    { key: 'onTrack', label: 'Open · on track', count: summary.onTrack || 0 },
    { key: 'atRisk', label: 'Open · at risk', count: summary.atRisk || 0 },
    { key: 'breached', label: 'Open · overdue', count: summary.breached || 0 }
  ];
}

export function formatPriorityCompliance(rows) {
  const byPriority = new Map(rows.map(row => [row._id, row]));
  return ['critical', 'high', 'medium', 'low'].map(priority => {
    const row = byPriority.get(priority);
    const resolved = row?.resolved || 0;
    const onTime = row?.onTime || 0;
    return { priority, resolved, onTime, late: resolved - onTime, rate: resolved ? Math.round(onTime / resolved * 1000) / 10 : null };
  });
}

export function formatAgeBuckets(rows = []) {
  const byBucket = new Map(rows.map(row => [row._id, row.count]));
  return [
    { key: 'under4', label: 'Under 4 hours', count: byBucket.get('under4') || 0 },
    { key: '4to24', label: '4–24 hours', count: byBucket.get('4to24') || 0 },
    { key: '1to3days', label: '1–3 days', count: byBucket.get('1to3days') || 0 },
    { key: 'over3days', label: 'Over 3 days', count: byBucket.get('over3days') || 0 }
  ];
}
