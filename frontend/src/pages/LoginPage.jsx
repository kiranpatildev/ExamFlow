import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../api/auth';
import LoadingSpinner from '../components/LoadingSpinner';

export default function LoginPage({ role, title, subtitle, accentColor }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const REDIRECT = {
    scanning_staff: '/scanning',
    teacher: '/teacher',
    exam_dept: '/exam-dept',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError('Please enter username and password.'); return; }
    setLoading(true); setError('');
    try {
      const res = await loginApi(username.trim(), password);
      if (res.data.role !== role) { setError(`This portal is for ${title} only.`); return; }
      login(res.data);
      navigate(REDIRECT[role] || '/');
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Invalid username or password.');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div style={{ width: '100%', maxWidth: '900px', display: 'flex', alignItems: 'center', gap: '60px' }}>

        {/* Left — Branding */}
        <div style={{ flex: 1, display: 'none' }} className="login-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{
              width: '44px', height: '44px', background: '#1a202c',
              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px',
            }}>🎓</div>
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#1a202c' }}>ExamFlow</span>
          </div>
          <h1 style={{ fontSize: '2rem', color: '#1a202c', marginBottom: '12px' }}>
            College Examination<br/>Management System
          </h1>
          <p style={{ color: '#718096', lineHeight: 1.7 }}>
            Digitize, manage, and evaluate answer sheets efficiently on your college LAN network.
          </p>
        </div>

        {/* Right — Login Card */}
        <div className="login-card fade-in-up" style={{ margin: '0 auto' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <div style={{
              width: '36px', height: '36px', background: '#1a202c',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
            }}>🎓</div>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#1a202c', letterSpacing: '-0.02em' }}>ExamFlow</span>
          </div>

          <h2 style={{ marginBottom: '4px', fontSize: '20px' }}>Sign in</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            {subtitle}
          </p>

          {/* Role pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px', borderRadius: '999px',
            background: '#f7fafc', border: '1px solid var(--color-border)',
            fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)',
            marginBottom: '20px',
          }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: accentColor || '#1a202c', display: 'inline-block',
            }} />
            {title}
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="username-input">Username</label>
              <input
                id="username-input"
                type="text"
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '11px', marginTop: '4px', fontSize: '15px' }}
            >
              {loading ? <><LoadingSpinner size="sm" /> Signing in...</> : `Sign in as ${title}`}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'var(--color-text-dim)', fontSize: '12px', marginTop: '24px' }}>
            © 2024 ExamFlow. College Examination System.
          </p>
        </div>
      </div>
    </div>
  );
}
