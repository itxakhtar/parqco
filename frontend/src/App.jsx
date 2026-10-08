import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import api from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Booking from './pages/Booking.jsx';
import Predictions from './pages/Predictions.jsx';
import Admin from './pages/Admin.jsx';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('parqco_token');
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch { localStorage.removeItem('parqco_token'); }
      setLoading(false);
    })();
  }, []);

  const logout = () => {
    localStorage.removeItem('parqco_token');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading }}>
      <header className="topbar">
        <Link to="/" className="brand">🅿️ PARQCO</Link>
        <nav>
          {user ? (
            <>
              <Link to="/">Live Map</Link>
              <Link to="/bookings">Bookings</Link>
              <Link to="/predictions">AI Predictions</Link>
              {user.role === 'admin' && <Link to="/admin">Admin</Link>}
              <span className="who">{user.name}</span>
              <button className="linkbtn" onClick={logout}>Logout</button>
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </nav>
      </header>
      <main className="wrap">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/bookings" element={<Protected><Booking /></Protected>} />
          <Route path="/predictions" element={<Protected><Predictions /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
        </Routes>
      </main>
      <footer className="foot">PARQCO — Smart Parking Management System with AI Predictions · FYP 2026</footer>
    </AuthCtx.Provider>
  );
}
