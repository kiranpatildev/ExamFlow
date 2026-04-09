import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBundles } from '../../api/bundles';
import { getAnswerSheets } from '../../api/answerSheets';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ExamDashboard() {
  const [bundles, setBundles] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [bRes, sRes] = await Promise.all([
          getBundles({}),
          getAnswerSheets({ page_size: 100 }),
        ]);
        setBundles(bRes.data.results || []);
        setSheets(sRes.data.results || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const stats = [
    { label: 'Total Sheets', value: sheets.length, icon: '📄', bg: '#ebf8ff', iconBg: '#bee3f8' },
    { label: 'Pending',      value: sheets.filter(s => s.status === 'pending').length, icon: '⏳', bg: '#fffff0', iconBg: '#fefcbf' },
    { label: 'Assigned',     value: sheets.filter(s => s.status === 'assigned').length, icon: '👩‍🏫', bg: '#f0fff4', iconBg: '#c6f6d5' },
    { label: 'Completed',    value: sheets.filter(s => s.status === 'completed').length, icon: '✅', bg: '#f0fff4', iconBg: '#c6f6d5' },
  ];

  return (
    <div className="main-layout">
      <AppSidebar role="exam_dept" userName={auth?.fullName || 'Admin'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          {/* Header */}
          <div className="page-header">
            <div className="page-header-left">
              <h1>Dashboard</h1>
              <p>Overview of all bundles and answer sheets in the system.</p>
            </div>
            <button id="go-assign-btn" className="btn btn-primary" onClick={() => navigate('/exam-dept/assign')}>
              + Assign Teachers
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
            {stats.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-card-icon" style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <div className="stat-card-info">
                  <div className="stat-card-value">{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bundles table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Recent Bundles</h3>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{bundles.length} total</span>
            </div>
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center' }}><LoadingSpinner size="lg" text="Loading..." /></div>
            ) : bundles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <h3>No bundles yet</h3>
                <p>Bundles appear here once scanning staff submit them.</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bundle #</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundles.slice(0, 10).map(b => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600 }}>#{b.bundle_number}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{b.subject?.subject_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{b.subject?.subject_code}</div>
                        </td>
                        <td><StatusBadge status={b.status} /></td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                          {new Date(b.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button id="go-users-btn" className="btn btn-secondary" onClick={() => navigate('/exam-dept/users')}>👥 Manage Users</button>
            <button id="go-schemes-btn" className="btn btn-secondary" onClick={() => navigate('/exam-dept/schemes')}>📚 Subjects & Schemes</button>
            <button id="go-reports-btn" className="btn btn-secondary" onClick={() => navigate('/exam-dept/reports')}>📊 View Reports</button>
          </div>
        </div>

        <footer className="main-footer">
          <span>© 2024 ExamFlow. All rights reserved.</span>
          <span>College Examination Management System</span>
        </footer>
      </div>
    </div>
  );
}
