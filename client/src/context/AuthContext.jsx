import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setCsrf } from '../api/client';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    api('/auth/me').then(({ user, csrfToken }) => {
      if (active) { setCsrf(csrfToken); setUser(user); }
    }).catch(() => { if (active) { setCsrf(''); setUser(null); } }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setCsrf(data.csrfToken);
    setUser(data.user);
  }, []);
  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); }
    finally { setCsrf(''); setUser(null); }
  }, []);
  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
