import { Activity, ArrowRightFromLine, BarChart3, ClipboardList, Gauge, Menu, Plus, Settings2, ShieldCheck, Users, X } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

const navigation = [
  { to: '/', text: 'Overview', icon: Gauge, end: true },
  { to: '/tickets', text: 'Tickets', icon: ClipboardList },
  { to: '/reports', text: 'Analytics', icon: BarChart3 }
];

const managerNavigation = [
  { to: '/team', text: 'Team', icon: Users },
  { to: '/policies', text: 'SLA policies', icon: Settings2 }
];

function Links({ items, onClick }) {
  return items.map(({ to, text, icon: Icon, end }) => (
    <NavLink
      key={to}
      end={end}
      to={to}
      onClick={onClick}
      className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
    >
      <Icon size={18} strokeWidth={1.8}/>
      <span>{text}</span>
    </NavLink>
  ));
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  async function signOut() {
    setBusy(true);
    try {
      await logout();
    } finally {
      nav('/login');
      setBusy(false);
    }
  }

  const pageTitle = ({
    '/': 'Overview',
    '/tickets': 'Tickets',
    '/tickets/new': 'New ticket',
    '/reports': 'Analytics',
    '/team': 'Team',
    '/policies': 'SLA policies'
  })[location.pathname] || 'Ticket details';

  return (
    <div className="shell">
      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Mobile Drawer */}
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={23} strokeWidth={2.4}/></div>
          <div className="brand-copy">
            <strong>SLAWatch</strong>
            <small>Service intelligence</small>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE <span>01</span></div>

        <nav aria-label="Primary" className="sidebar-nav">
          <Links items={navigation} onClick={() => setMobileNavOpen(false)} />
          {user?.role === 'manager' && (
            <>
              <div className="sidebar-heading">ADMINISTRATION</div>
              <Links items={managerNavigation} onClick={() => setMobileNavOpen(false)} />
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={18}/>
            <span>Access scoped to your role. All changes audit logged.</span>
          </div>
          <div className="user-bar">
            <div className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</div>
            <div className="user-bar-text">
              <strong>{user?.name}</strong>
              <small>{user?.role === 'manager' ? 'Service manager' : 'Support agent'}</small>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              aria-label="Sign out"
              title="Sign out"
            >
              <ArrowRightFromLine size={17}/>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileNavOpen(o => !o)}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
            >
              <Menu size={22} strokeWidth={2} />
            </button>
            <div className="breadcrumb">
              <span className="breadcrumb-root">OPERATIONS</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{pageTitle}</span>
            </div>
          </div>

          <div className="topbar-right">
            <span className="environment">
              <span className="env-dot" />
              <span className="env-label">Internal workspace</span>
            </span>
            <NavLink to="/tickets/new" className="btn btn-primary btn-small">
              <Plus size={16}/>
              <span className="btn-label">New ticket</span>
            </NavLink>
            <button
              type="button"
              className="mobile-signout"
              onClick={signOut}
              disabled={busy}
              aria-label="Sign out"
              title="Sign out"
            >
              <ArrowRightFromLine size={18}/>
            </button>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>

        <footer className="footer">
          SLAWatch <span>·</span> IT service performance, clearly measured
        </footer>
      </div>
    </div>
  );
}
