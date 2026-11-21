import { Activity, ArrowRightFromLine, BarChart3, ClipboardList, Gauge, Plus, Settings2, ShieldCheck, Users } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
const navigation = [
  { to: '/', text: 'Overview', icon: Gauge, end: true },
  { to: '/tickets', text: 'Tickets', icon: ClipboardList },
  { to: '/reports', text: 'Analytics', icon: BarChart3 }
];
const managerNavigation = [{ to: '/team', text: 'Team', icon: Users }, { to: '/policies', text: 'SLA policies', icon: Settings2 }];
function Links({ items, onClick }) { return items.map(({ to, text, icon: Icon, end }) => <NavLink key={to} end={end} to={to} onClick={onClick} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}><Icon size={18} strokeWidth={1.8}/>{text}</NavLink>); }
export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  async function signOut() { setBusy(true); try { await logout(); } finally { nav('/login'); setBusy(false); } }
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={23} strokeWidth={2.4}/></div><div><strong>SLAWatch</strong><small>Service intelligence</small></div></div>
      <div className="workspace-label">WORKSPACE <span>01</span></div>
      <nav aria-label="Primary"><Links items={navigation}/>{user?.role === 'manager' && <><div className="sidebar-heading">ADMINISTRATION</div><Links items={managerNavigation}/></>}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><ShieldCheck size={18}/><span>Access scoped to your role. All ticket changes are recorded.</span></div><div className="user-bar"><div className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</div><div className="user-bar-text"><strong>{user?.name}</strong><small>{user?.role === 'manager' ? 'Service manager' : 'Support agent'}</small></div><button type="button" onClick={signOut} disabled={busy} aria-label="Sign out" title="Sign out"><ArrowRightFromLine size={17}/></button></div></div>
    </aside>
    <div className="main-column"><header className="topbar"><div className="breadcrumb">OPERATIONS <span>/</span> {({ '/': 'Overview', '/tickets':'Tickets','/tickets/new':'New ticket','/reports':'Analytics','/team':'Team','/policies':'SLA policies' })[location.pathname] || 'Ticket details'}</div><div className="topbar-right"><span className="environment"><span/>Internal workspace</span><NavLink to="/tickets/new" className="btn btn-primary btn-small"><Plus size={16}/> New ticket</NavLink><button type="button" className="mobile-signout" onClick={signOut} disabled={busy} aria-label="Sign out" title="Sign out"><ArrowRightFromLine size={18}/></button></div></header><main className="main-content"><Outlet /></main><footer className="footer">SLAWatch <span>·</span> IT service performance, clearly measured</footer></div>
  </div>;
}
