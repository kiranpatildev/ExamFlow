import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBundles } from '../../api/bundles';
import { getAnswerSheets } from '../../api/answerSheets';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import BundleCard from '../../components/BundleCard';

function Sidebar({ navigate, logout, auth }) {
  const items = [
    { icon: '🏠', label: 'Dashboard', path: '/exam-dept' },
    { icon: '👥', label: 'Users', path: '/exam-dept/users' },
    { icon: '👩‍🏫', label: 'Assign Teachers', path: '/exam-dept/assign' },
    { icon: '📚', label: 'Subjects & Schemes', path: '/exam-dept/schemes' },
    { icon: '📊', label: 'Reports', path: '/exam-dept/reports' },
  ];
  const current = window.location.pathname;
  return (
    <aside className="sidebar">
      <div style={{ marginBottom: '28px' }}>
        <span style={{ fontSize: '20px' }}>🏛️</span>
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '16px', color: '#f59e0b', marginLeft: '8px' }}>
          ExamFlow
        </span>
      </div>
      <div style={{ flex: 1 }}>
        {items.map(item => (
          <div
            key={item.path}
            id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            className={`nav-item ${current === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
        <p style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>Exam Department</p>
        <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{auth?.fullName}</p>
        <button
          id="logout-btn"
          className="btn btn-secondary"
          onClick={logout}
          style={{ width: '100%', marginTop: '12px', padding: '7px' }}
        >Sign Out</button>
      </div>
    </aside>
  );
}

export default function ExamDashboard() {
  const [bundles, setBundles] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [bRes, sRes] = await Promise.all([
          getBundles({ status: statusFilter || undefined }),
          getAnswerSheets({ page_size: 50 }),
        ]);
        setBundles(bRes.data.results || []);
        setSheets(sRes.data.results || []);
      } catch {
        // Errors handled individually
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [statusFilter]);

  const stats = {
    total: sheets.length,
    pending: sheets.filter(s => s.status === 'pending').length,
    assigned: sheets.filter(s => s.status === 'assigned').length,
    completed: sheets.filter(s => s.status === 'completed').length,
  };

  return (
    <div className="main-layout">
      <Sidebar navigate={navigate} logout={logout} auth={auth} />

      <main className="main-content">
        <div style={{ marginBottom: '28px' }}>
          <h1 className="gradient-text" style={{ marginBottom: '6px' }}>Dashboard</h1>
          <p style={{ color: '#64748b' }}>Overview of all bundles and answer sheets.</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Total Sheets', value: stats.total, color: '#6366f1', icon: '📄' },
            { label: 'Pending', value: stats.pending, color: '#f59e0b', icon: '⏳' },
            { label: 'Assigned', value: stats.assigned, color: '#3b82f6', icon: '👩‍🏫' },
            { label: 'Completed', value: stats.completed, color: '#10b981', icon: '✅' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{
              background: `linear-gradient(135deg, ${stat.color}11, ${stat.color}06)`,
              borderColor: `${stat.color}22`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '22px' }}>{stat.icon}</span>
                <span style={{ fontSize: '26px', fontWeight: 800, color: stat.color }}>
                  {stat.value}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Bundles */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>Bundles</h2>
            <select
              id="bundle-status-filter"
              className="select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ width: '160px' }}
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <LoadingSpinner size="lg" />
            </div>
          ) : bundles.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
              No bundles found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bundles.map(b => (
                <BundleCard key={b.id} bundle={b} />
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button id="go-assign-btn" className="btn btn-primary" onClick={() => navigate('/exam-dept/assign')}>
            👩‍🏫 Assign Teachers
          </button>
          <button id="go-schemes-btn" className="btn btn-secondary" onClick={() => navigate('/exam-dept/schemes')}>
            📚 Manage Subjects
          </button>
          <button id="go-reports-btn" className="btn btn-secondary" onClick={() => navigate('/exam-dept/reports')}>
            📊 View Reports
          </button>
        </div>
      </main>
    </div>
  );
}

export { Sidebar };
