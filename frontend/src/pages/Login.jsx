import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../App.jsx';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = mode === 'login'
        ? await api.post('/auth/login', { email, password })
        : await api.post('/auth/register', { name, email, password });
      localStorage.setItem('parqco_token', data.token);
      setUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div className="card narrow">
      <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
      <div className="tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
      </div>
      <form onSubmit={submit} className="form">
        {mode === 'register' && (
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="err">{error}</div>}
        <button type="submit">{mode === 'login' ? 'Login' : 'Register'}</button>
      </form>
    </div>
  );
}
