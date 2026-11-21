export const PRIORITIES = ['critical', 'high', 'medium', 'low'];
export const STATUSES = ['open', 'in_progress', 'resolved'];
export const CATEGORIES = ['hardware', 'software', 'network', 'access', 'other'];
export const DEFAULT_HOURS = Object.freeze({ critical: 4, high: 8, medium: 24, low: 72 });

export function slaDeadline(startedAt, targetHours) {
  if (!Number.isFinite(targetHours) || targetHours <= 0) throw new Error('Invalid SLA target');
  return new Date(new Date(startedAt).getTime() + targetHours * 3600000);
}

export function getSlaState(ticket, now = new Date()) {
  const due = new Date(ticket.slaDueAt).getTime();
  const start = new Date(ticket.createdAt).getTime();
  if (ticket.status === 'resolved') {
    return new Date(ticket.resolvedAt).getTime() > due ? 'breached' : 'met';
  }
  const nowMs = new Date(now).getTime();
  if (nowMs > due) return 'breached';
  const elapsed = nowMs - start;
  const total = due - start;
  return total > 0 && elapsed / total >= 0.8 ? 'at_risk' : 'on_track';
}

export function canChangeStatus(from, to) {
  if (from === to) return true;
  if (from === 'resolved') return false;
  return (from === 'open' && ['in_progress', 'resolved'].includes(to)) ||
    (from === 'in_progress' && to === 'resolved');
}

export function normalizeFilters(filters = {}) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
}
