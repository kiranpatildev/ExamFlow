import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTeacherBundleSheets } from '../../api/teacher';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function BundleSheetList() {
  const { bundleId } = useParams();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTeacherBundleSheets(bundleId);
      setSheets(res.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [bundleId]);

  return (
    <div className="main-layout">
      <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          <div className="page-header" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button className="btn" style={{ padding: '8px', background: '#f1f5f9' }} onClick={() => navigate('/teacher')}>
              ← Back
            </button>
            <div className="page-header-left">
              <h1>Bundle #{sheets[0]?.bundle?.bundle_number || bundleId} Sheets</h1>
              <p>Answer sheets in this bundle assigned to you.</p>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}><LoadingSpinner size="lg" text="Loading sheets..." /></div>
          ) : sheets.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3>No sheets found</h3>
                <p>No sheets assigned to you in this bundle.</p>
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map(s => {
                    const isCompleted = s.status === 'completed';
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.roll_number}</td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: isCompleted ? '#f0fff4' : '#fffff0',
                            color: isCompleted ? '#16a34a' : '#ca8a04',
                          }}>
                            {isCompleted ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '5px 14px', fontSize: '13px' }}
                            onClick={() => navigate(`/teacher/evaluate/${s.id}?bundleId=${bundleId}`)}
                          >
                            {isCompleted ? 'View' : 'Evaluate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
