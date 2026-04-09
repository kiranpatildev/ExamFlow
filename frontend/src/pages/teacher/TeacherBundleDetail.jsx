import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTeacherBundleSheets } from '../../api/teacher';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

/**
 * TeacherBundleDetail — lists all answer sheets in a bundle assigned to
 * the current teacher. Click a sheet to start evaluation.
 *
 * Route: /teacher/bundle/:bundleId
 */
export default function TeacherBundleDetail() {
  const { bundleId } = useParams();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getTeacherBundleSheets(bundleId)
      .then(res => setSheets(res.data || []))
      .catch(() => toast.error('Could not load sheets.'))
      .finally(() => setLoading(false));
  }, [bundleId]);

  const pending   = sheets.filter(s => s.status !== 'completed');
  const completed = sheets.filter(s => s.status === 'completed');

  const handleEvaluate = (sheetId) => {
    navigate(`/teacher/evaluate/${sheetId}?bundleId=${bundleId}`);
  };

  const stats = [
    { label: 'Total Sheets', value: sheets.length,    icon: '📄', bg: '#f7fafc' },
    { label: 'Remaining',    value: pending.length,   icon: '⏳', bg: '#fffff0' },
    { label: 'Completed',    value: completed.length, icon: '✅', bg: '#f0fff4' },
  ];

  return (
    <div className="main-layout">
      <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Bundle #{bundleId}</h1>
              <p>Answer sheets assigned to you — click any sheet to evaluate.</p>
            </div>
            <button className="btn btn-secondary" onClick={() => navigate('/teacher')}>
              ← Back to Bundles
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '24px' }}>
            {stats.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div>
                <div className="stat-card-info">
                  <div className="stat-card-value">{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <LoadingSpinner size="lg" text="Loading sheets..." />
            </div>
          ) : sheets.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3>No sheets assigned</h3>
                <p>No answer sheets have been assigned to you in this bundle yet.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Roll Number</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map((s, i) => (
                      <tr key={s.id}>
                        <td style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.roll_number}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            id={`eval-btn-${s.id}`}
                            className={`btn ${s.status === 'completed' ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '6px 16px', fontSize: '13px' }}
                            onClick={() => handleEvaluate(s.id)}
                          >
                            {s.status === 'completed' ? 'View Result' : 'Evaluate →'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Quick-start button for first pending sheet */}
              {pending.length > 0 && (
                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                  <button
                    id="start-next-btn"
                    className="btn btn-primary"
                    onClick={() => handleEvaluate(pending[0].id)}
                    style={{ padding: '12px 28px', fontSize: '15px' }}
                  >
                    Start Evaluating Next Sheet →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="main-footer">
          <span>© 2024 ExamFlow. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}
