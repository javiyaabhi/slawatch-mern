import { AlertCircle, CheckCircle2, CircleHelp, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}
export function StatusBadge({ status }) {
  const name = ({ open: 'Open', in_progress: 'In progress', resolved: 'Resolved', archived: 'Archived', breached: 'Breached', at_risk: 'At risk', on_track: 'On track', met: 'Met SLA', pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected' })[status] || status;
  return <span className={`status status-${status}`}>{name}</span>;
}
export function Priority({ level }) { return <span className={`priority priority-${level}`}><i />{level[0].toUpperCase() + level.slice(1)}</span>; }
export function ErrorNotice({ error }) {
  if (!error) return null;
  return <div className="notice notice-error" role="alert"><AlertCircle size={18}/><span>{typeof error === 'string' ? error : error.message}</span></div>;
}
export function SuccessNotice({ message }) {
  if (!message) return null;
  return <div className="notice notice-success" role="status"><CheckCircle2 size={18}/><span>{message}</span></div>;
}
export function Loading() { return <div className="loading" role="status"><LoaderCircle size={22} className="spin"/>Loading workspace…</div>; }
export function Empty({ title='Nothing to show yet', description, action }) {
  return <div className="empty"><CircleHelp size={23} strokeWidth={1.5}/><h3>{title}</h3><p>{description || 'Records will appear here as your team starts working.'}</p>{action && <Link to={action.to} className="btn btn-secondary">{action.text}</Link>}</div>;
}
export function dateTime(value) { if (!value) return '—'; return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
export function shortDate(value) { if (!value) return '—'; return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
export function duration(value) { return value == null ? '—' : `${Number(value).toFixed(1)}h`; }
export function slaState(ticket) {
  if (ticket.status === 'resolved') return new Date(ticket.resolvedAt) > new Date(ticket.slaDueAt) ? 'breached' : 'met';
  const now = Date.now(), deadline = new Date(ticket.slaDueAt).getTime(), start = new Date(ticket.createdAt).getTime();
  if (now > deadline) return 'breached';
  return deadline > start && (now - start) / (deadline - start) >= 0.8 ? 'at_risk' : 'on_track';
}
