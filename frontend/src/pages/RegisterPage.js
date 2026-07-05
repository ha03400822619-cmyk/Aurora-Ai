import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { POST_AUTH_WORKSPACE_BOOT_KEY } from '../constants/workspaceSession';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      try {
        sessionStorage.setItem(POST_AUTH_WORKSPACE_BOOT_KEY, '1');
      } catch {
        /* ignore */
      }
      navigate('/dashboard', { replace: true });
      toast.success('Account created! Welcome to Aurora');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <img src="/aurora-brand-template.png" alt="Aurora AI logo" className="auth-logo" />
        <div className="auth-sub">Create your free account</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="input" type="text" placeholder="Your name"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="input" type="password" placeholder="Min 6 characters"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
