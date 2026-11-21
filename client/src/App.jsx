import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import NewTicket from './pages/NewTicket';
import TicketDetail from './pages/TicketDetail';
import Reports from './pages/Reports';
import Team from './pages/Team';
import Policies from './pages/Policies';
import { Loading } from './components/UI';
function RequireAuth({ children, managerOnly = false }) {
  const {user,ready} = useAuth(); const location = useLocation();
  if (!ready) return <Loading/>;
  if (!user) return <Navigate to="/login" state={{from:location}} replace/>;
  if (managerOnly && user.role!=='manager') return <Navigate to="/" replace/>;
  return children;
}
function GuestRoute({ children }) {
  const {user,ready} = useAuth(); if (!ready) return <Loading/>;
  return user ? <Navigate to="/" replace/> : children;
}
export default function App() { return <BrowserRouter><AuthProvider><Routes>
  <Route path="/login" element={<GuestRoute><Login/></GuestRoute>}/>
  <Route element={<RequireAuth><Layout/></RequireAuth>}>
    <Route index element={<Dashboard/>}/>
    <Route path="tickets" element={<Tickets/>}/>
    <Route path="tickets/new" element={<NewTicket/>}/>
    <Route path="tickets/:id" element={<TicketDetail/>}/>
    <Route path="reports" element={<Reports/>}/>
  </Route>
  <Route element={<RequireAuth managerOnly><Layout/></RequireAuth>}>
    <Route path="team" element={<Team/>}/>
    <Route path="policies" element={<Policies/>}/>
  </Route>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></AuthProvider></BrowserRouter>; }
