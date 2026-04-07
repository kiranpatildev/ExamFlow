import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { submitBundle } from '../../api/bundles';
import { getAnswerSheets } from '../../api/answerSheets';
import { useEffect } from 'react';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function BundleReview() {
  const { bundleId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const bundle = state?.bundle;

  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAnswerSheets({ bundle_id: bundleId });
        setSheets(res.data.results || []);
      } catch {
        setError('Failed to load sheets.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bundleId]);

  const handleSubmit = async () => {
    if (sheets.length === 0) {
      setError('No finalized sheets to submit.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitBundle(bundleId);
      setSubmitted(true);
      toast.success('Bundle submitted successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '18px', color: '#10b981' }}>
          📋 Review Bundle
        </span>
        <button id="back-upload-btn" className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Back to Upload
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>

          {/* Bundle info */}
          <div className="card fade-in-up" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ marginBottom: '4px' }}>
                  Bundle #{bundle?.bundle_number || bundleId}
                </h2>
                <p style={{ color: '#64748b', fontSize: '14px' }}>
                  {bundle?.subject?.subject_code} — {bundle?.subject?.subject_name}
                </p>
              </div>
              <StatusBadge status={submitted ? 'submitted' : 'open'} />
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {submitted && (
            <div className="alert alert-success">
              ✅ Bundle submitted successfully. No further changes can be made.
            </div>
          )}

          {/* Sheets table */}
          <div className="card fade-in-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Finalized Answer Sheets ({sheets.length})</h3>
              {!submitted && sheets.length > 0 && (
                <button
                  id="submit-bundle-btn"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <><LoadingSpinner size="sm" /> Submitting...</> : '✅ Submit Bundle'}
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <LoadingSpinner size="lg" text="Loading sheets..." />
              </div>
            ) : sheets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
                <p>No answer sheets finalized yet.</p>
                <button
                  id="go-upload-btn"
                  className="btn btn-secondary"
                  onClick={() => navigate(-1)}
                  style={{ marginTop: '12px' }}
                >
                  Go Upload Sheets
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Roll Number</th>
                      <th>Status</th>
                      <th>Uploaded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map((s, i) => (
                      <tr key={s.id}>
                        <td style={{ color: '#64748b' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.roll_number}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td style={{ color: '#64748b', fontSize: '12px' }}>
                          {new Date(s.uploaded_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!submitted && (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                id="go-home-btn"
                className="btn btn-secondary"
                onClick={() => navigate('/scanning')}
              >
                Create New Bundle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
