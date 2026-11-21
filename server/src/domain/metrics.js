export function percent(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}
export function hoursBetween(from, to) {
  return Math.round(((new Date(to) - new Date(from)) / 3600000) * 10) / 10;
}
export function slaSummary(tickets, now = new Date()) {
  return tickets.reduce((sum, ticket) => {
    const resolved = ticket.status === 'resolved';
    const completedAt = resolved ? new Date(ticket.resolvedAt) : now;
    const breached = completedAt > new Date(ticket.slaDueAt);
    sum.total++;
    if (resolved) { sum.resolved++; if (breached) sum.breachedResolved++; }
    else { sum.open++; if (breached) sum.breachedOpen++; }
    return sum;
  }, { total: 0, resolved: 0, open: 0, breachedResolved: 0, breachedOpen: 0 });
}
