import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnswerSheets } from '../../api/answerSheets';
import { submitBundle } from '../../api/bundles'; // ← correct module
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function BundleReview() {
  const { bundleId } = useParams();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getAnswerSheets({ bundle_id: bundleId, page_size: 100 })
      .then(res => {
        // API returns paginated { count, results: [...] }
        setSheets(res.data.results || res.data || []);
      })
      .catch(() => toast.error('Could not load sheets.'))
      .finally(() => setLoading(false));
  }, [bundleId]);

  const handleSubmit = async () => {
    if (sheets.length === 0) { toast.error('No sheets in this bundle.'); return; }
    if (!window.confirm(`Submit bundle with ${sheets.length} sheet(s) to the exam department? This cannot be undone.`)) return;

    setSubmitting(true);
    try {
      await submitBundle(bundleId);
      toast.success('Bundle submitted successfully!');
      navigate('/scanning');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = [
    { label: 'Total Sheets', value: sheets.length, icon: '📄', bg: '#f7fafc' },
    { label: 'Finalized',    value: sheets.filter(s => s.status !== 'pending').length, icon: '✅', bg: '#f0fff4' },
    { label: 'Pending',      value: sheets.filter(s => s.status === 'pending').length, icon: '⏳', bg: '#fffff0' },
  ];

  return (
    <div className="main-layout">
      <AppSidebar role="scanning_staff" userName={auth?.fullName || 'Staff'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Review Bundle</h1>
              <p>Bundle #{bundleId} — Verify all sheets, then submit to the exam department.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/scanning/upload/${bundleId}`)}
              >
                ← Add More Sheets
              </button>
              <button
                id="submit-bundle-btn"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || sheets.length === 0}
              >
                {submitting
                  ? <><LoadingSpinner size="sm" /> Submitting...</>
                  : `✅ Submit Bundle (${sheets.length} sheets)`}
              </button>
            </div>
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

          {/* Content */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <LoadingSpinner size="lg" text="Loading sheets..." />
            </div>
          ) : sheets.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3>No sheets in this bundle</h3>
                <p>Go back and upload answer sheet images first.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/scanning/upload/${bundleId}`)}
                  style={{ marginTop: '12px' }}
                >
                  ← Upload Sheets
                </button>
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
                      <th>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map((s, i) => (
                      <tr key={s.id}>
                        <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.roll_number}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                          {new Date(s.uploaded_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button
                  id="final-submit-btn"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ padding: '12px 28px', fontSize: '15px' }}
                >
                  {submitting
                    ? <><LoadingSpinner size="sm" /> Submitting...</>
                    : `✅ Submit Bundle (${sheets.length} sheets)`}
                </button>
              </div>
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
