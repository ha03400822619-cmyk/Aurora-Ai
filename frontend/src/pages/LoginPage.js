import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { POST_AUTH_WORKSPACE_BOOT_KEY } from '../constants/workspaceSession';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      try {
        sessionStorage.setItem(POST_AUTH_WORKSPACE_BOOT_KEY, '1');
      } catch {
        /* ignore */
      }
      navigate('/dashboard', { replace: true });
      toast.success('Welcome back!');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back-home">← Aurora home</Link>
      <div className="auth-box">
        <img src="/aurora-brand-template.png" alt="Aurora AI logo" className="auth-logo" />
        <div className="auth-sub">Your intelligent study companion</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="input" type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="auth-footer">
          Don't have an account? <Link to="/register">Sign up free</Link>
        </div>
      </div>
    </div>
  );
}
