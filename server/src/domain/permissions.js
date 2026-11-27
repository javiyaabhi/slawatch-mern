/** Archived records remain manager-readable but are never editable. */
export function mayReadTicket(ticket, user, { allowArchived = false } = {}) {
  if (!ticket || !user) return false;
  if (ticket.archivedAt) return allowArchived && user.role === 'manager';
  return user.role === 'manager' || String(ticket.assignedTo) === String(user._id);
}
export function mayViewArchive(user) { return user?.role === 'manager'; }
/** Shared scoping keeps lists, dashboards and reports in agreement. */
export function ticketScope(user, { archivedOnly = false } = {}) {
  if (archivedOnly) {
    if (!mayViewArchive(user)) throw new Error('Only managers may query archived records');
    return { archivedAt: { $ne: null } };
  }
  return user.role === 'manager'
    ? { archivedAt: null }
    : { archivedAt: null, assignedTo: user._id };
}
export function mayEditTicketFields(user, input) {
  return user.role === 'manager' || Object.keys(input).every(k => k === 'status');
}
export function mayArchiveTicket(ticket, user) {
  return user.role === 'manager' && ticket?.status === 'resolved' && !ticket.archivedAt;
}
export function mayApproveTicket(user) {
  return user?.role === 'manager';
}
