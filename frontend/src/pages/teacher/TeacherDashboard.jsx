import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeacherBundles } from '../../api/teacher';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function TeacherDashboard() {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [navigatingBundleId, setNavigatingBundleId] = useState(null);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTeacherBundles();
      setBundles(res.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleStartEvaluating = (b) => {
    console.log("Start Evaluating clicked. Bundle object:", b);
    if (!b || !b.id) {
      console.error("Bundle ID is missing from object:", b);
      alert("Error: Bundle ID is missing.");
      return;
    }
    
    setNavigatingBundleId(b.id);
    // Add small delay to show loading state
    setTimeout(() => {
      navigate(`/teacher/bundle/${b.id}`);
    }, 100);
  };

  const totalSheets = bundles.reduce((acc, b) => acc + b.total_sheets, 0);
  const evaluatedSheets = bundles.reduce((acc, b) => acc + b.evaluated_count, 0);

  return (
    <div className="main-layout">
      <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          <div className="page-header">
            <div className="page-header-left">
              <h1>My Assigned Bundles</h1>
              <p>Bundles of answer sheets assigned to you for evaluation.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: '#f7fafc' }}>📦</div>
              <div className="stat-card-info">
                <div className="stat-card-value">{bundles.length}</div>
                <div className="stat-card-label">Total Bundles</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: '#fffff0' }}>📄</div>
              <div className="stat-card-info">
                <div className="stat-card-value">{totalSheets}</div>
                <div className="stat-card-label">Total Sheets</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: '#f0fff4' }}>✅</div>
              <div className="stat-card-info">
                <div className="stat-card-value">{evaluatedSheets}</div>
                <div className="stat-card-label">Evaluated</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}><LoadingSpinner size="lg" text="Loading bundles..." /></div>
          ) : bundles.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3>No bundles assigned</h3>
                <p>Check back after the exam department assigns bundles to you.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {bundles.map(b => {
                const progressPct = b.total_sheets > 0 ? (b.evaluated_count / b.total_sheets) * 100 : 0;
                let status = 'Not Started';
                if (b.evaluated_count > 0 && b.evaluated_count < b.total_sheets) status = 'In Progress';
                if (b.evaluated_count === b.total_sheets && b.total_sheets > 0) status = 'Completed';

                return (
                  <div key={b.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: 'var(--color-primary)' }}>{b.subject_name}</h3>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{b.subject_code}</div>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Bundle #{b.bundle_number}</span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 500 }}>Progress: <span style={{ color: 'var(--color-text-muted)' }}>{b.evaluated_count} / {b.total_sheets}</span></span>
                        <span style={{ 
                          color: status === 'Completed' ? 'var(--color-emerald)' : status === 'In Progress' ? 'var(--color-yellow)' : 'var(--color-text-muted)',
                          fontWeight: 600 
                        }}>{status}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: status === 'Completed' ? 'var(--color-emerald)' : 'var(--color-indigo)', width: `${progressPct}%`, transition: 'width 0.3s ease' }}></div>
                      </div>
                    </div>

                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                      disabled={navigatingBundleId === b.id}
                      onClick={() => handleStartEvaluating(b)}
                    >
                      {navigatingBundleId === b.id ? (
                        <><LoadingSpinner size="sm" /> Loading...</>
                      ) : (
                        status === 'Completed' ? 'View Bundle' : status === 'In Progress' ? 'Continue Evaluating →' : 'Start Evaluating →'
                      )}
                    </button>
                  </div>
                );
              })}
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
