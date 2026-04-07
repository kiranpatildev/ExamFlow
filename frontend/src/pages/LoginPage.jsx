import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../api/auth';
import LoadingSpinner from '../components/LoadingSpinner';

export default function LoginPage({ role, title, subtitle, color, icon }) {
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
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await loginApi(username.trim(), password);
      const data = res.data;
      if (data.role !== role) {
        setError(`Invalid credentials for ${title}.`);
        return;
      }
      login(data);
      navigate(REDIRECT[role] || '/');
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Login failed. Check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card fade-in-up">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: `linear-gradient(135deg, ${color}22, ${color}44)`,
            border: `1px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', margin: '0 auto 16px',
          }}>{icon}</div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '6px' }}>
            <span className="gradient-text">ExamFlow</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          {error && (
            <div className="alert alert-error" role="alert">{error}</div>
          )}

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
              placeholder="••••••••"
            />
          </div>

          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
          >
            {loading ? <><LoadingSpinner size="sm" /> Signing in...</> : `Sign in as ${title}`}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '24px' }}>
          ExamFlow — Answer Sheet Evaluation System
        </p>
      </div>
    </div>
  );
}
