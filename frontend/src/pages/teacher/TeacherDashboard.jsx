import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnswerSheets } from '../../api/answerSheets';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function TeacherDashboard() {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', subject_id: '' });
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const loadSheets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.subject_id) params.subject_id = filters.subject_id;
      const res = await getAnswerSheets(params);
      setSheets(res.data.results || []);
    } catch {
      setError('Failed to load answer sheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSheets(); }, [filters]);

  return (
    <div className="main-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '20px' }}>📝</span>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '16px', color: '#818cf8', marginLeft: '8px' }}>
            ExamFlow
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="nav-item active">📄 My Assignments</div>
        </div>
        <div style={{
          borderTop: '1px solid var(--color-border)', paddingTop: '16px',
          marginTop: '16px',
        }}>
          <p style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>Signed in as</p>
          <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{auth?.fullName}</p>
          <button
            id="logout-btn"
            className="btn btn-secondary"
            onClick={logout}
            style={{ width: '100%', marginTop: '12px', padding: '7px' }}
          >Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 className="gradient-text" style={{ marginBottom: '6px' }}>My Answer Sheets</h1>
          <p style={{ color: '#64748b' }}>All sheets assigned to you for evaluation.</p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <select
            id="status-filter"
            className="select"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            style={{ width: '180px' }}
          >
            <option value="">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="under_evaluation">Under Evaluation</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <LoadingSpinner size="lg" text="Loading your sheets..." />
          </div>
        ) : sheets.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ color: '#94a3b8' }}>No sheets assigned yet.</h3>
            <p style={{ color: '#475569' }}>Check back after the exam department assigns sheets to you.</p>
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
                  <th>Uploaded At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.roll_number}</td>
                    <td>
                      <div>{s.subject?.subject_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{s.subject?.subject_code}</div>
                    </td>
                    <td style={{ color: '#64748b' }}>#{s.bundle_number}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {new Date(s.uploaded_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        id={`evaluate-btn-${s.id}`}
                        className="btn btn-primary"
                        style={{ padding: '5px 14px', fontSize: '13px' }}
                        onClick={() => navigate(`/teacher/evaluate/${s.id}`)}
                        disabled={s.status === 'pending'}
                      >
                        {s.status === 'completed' ? '👁 View' : '✏️ Evaluate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
