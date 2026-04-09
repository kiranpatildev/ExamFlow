import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnswerSheets } from '../../api/answerSheets';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function TeacherDashboard() {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await getAnswerSheets(params);
      setSheets(res.data.results || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const tabs = [
    { key: '', label: 'All' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'under_evaluation', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ];

  const counts = {
    total: sheets.length,
    pending: sheets.filter(s => s.status === 'assigned').length,
    completed: sheets.filter(s => s.status === 'completed').length,
  };

  return (
    <div className="main-layout">
      <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          <div className="page-header">
            <div className="page-header-left">
              <h1>My Assignments</h1>
              <p>Answer sheets assigned to you for evaluation.</p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: 'Total Assigned', value: counts.total, icon: '📄', bg: '#f7fafc' },
              { label: 'Pending', value: counts.pending, icon: '⏳', bg: '#fffff0' },
              { label: 'Completed', value: counts.completed, icon: '✅', bg: '#f0fff4' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div>
                <div className="stat-card-info">
                  <div className="stat-card-value">{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="filter-tabs" style={{ marginBottom: '20px' }}>
            {tabs.map(t => (
              <button key={t.key}
                className={`filter-tab ${statusFilter === t.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}><LoadingSpinner size="lg" text="Loading..." /></div>
          ) : sheets.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3>No sheets assigned</h3>
                <p>Check back after the exam department assigns sheets to you.</p>
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Subject</th>
                    <th>Bundle</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.roll_number}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.subject?.subject_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{s.subject?.subject_code}</div>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)' }}>#{s.bundle_number}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        {new Date(s.uploaded_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          id={`eval-${s.id}`}
                          className="btn btn-primary"
                          style={{ padding: '5px 14px', fontSize: '13px' }}
                          onClick={() => navigate(`/teacher/evaluate/${s.id}`)}
                          disabled={s.status === 'pending'}
                        >
                          {s.status === 'completed' ? 'View' : 'Evaluate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <footer className="main-footer">
          <span>© 2024 ExamFlow. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}
