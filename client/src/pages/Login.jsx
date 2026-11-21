import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ErrorNotice } from '../components/UI';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); navigate('/', { replace: true }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="login-screen"><div className="login-left"><div className="login-brand"><Activity size={24}/> SLAWatch <span> / service intelligence</span></div><div className="login-hero"><div className="eyebrow light">OPERATIONS, WITHOUT THE GUESSWORK</div><h1>Know what's<br/>slowing your<br/><em>service down.</em></h1><p>Clear ticket ownership, meaningful SLA metrics, and a single place to see where attention is needed.</p></div><div className="login-bottom">Built for service teams who care about the details. <span>2026</span></div></div><div className="login-right"><form className="login-form" onSubmit={submit}><div className="login-emblem"><LockKeyhole size={22}/></div><div className="eyebrow">YOUR WORKSPACE</div><h2>Sign in</h2><p>Use the account provided by your service manager.</p><ErrorNotice error={error}/><label htmlFor="email">Work email</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@company.com"/><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Enter your password"/><button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Signing in…' : <>Continue to workspace <ArrowRight size={17}/></>}</button><small className="login-caption">Accounts are created by your service manager.</small></form></div></div>;
}
