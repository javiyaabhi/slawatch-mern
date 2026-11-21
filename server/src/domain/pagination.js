/** Reject ambiguous or oversized page parameters rather than silently coercing them. */
export function parseTicketPage(raw = '1') {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,3}$/.test(raw)) throw new Error('Invalid page number');
  return Number(raw);
}
