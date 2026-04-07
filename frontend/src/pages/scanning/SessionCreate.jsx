import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBundle } from '../../api/bundles';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

export default function SessionCreate() {
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!qrInput.trim()) {
      setError('Please enter or scan a QR code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await createBundle(qrInput.trim());
      navigate(`/scanning/upload/${res.data.id}`, { state: { bundle: res.data } });
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || 'Failed to create bundle.';
      setError(status === 404 ? `Subject not found: ${msg}` : msg);
    } finally {
      setLoading(false);
    }
  };

  const sampleQR = JSON.stringify({ subject_code: 'CS301', bundle_number: 'B-07', total_sheets: 30 });

  return (
    <div className="page-wrapper" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>📷</span>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '18px', color: '#10b981' }}>
            ExamFlow — Scanning Staff
          </span>
        </div>
        <button id="logout-btn" className="btn btn-secondary" onClick={logout} style={{ padding: '6px 16px' }}>
          Sign Out
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          <div className="fade-in-up">
            <h1 style={{ marginBottom: '8px' }}>Create Bundle Session</h1>
            <p style={{ color: '#94a3b8', marginBottom: '32px' }}>
              Scan or type the QR code from the answer sheet bundle cover page.
            </p>

            <div className="card">
              <form onSubmit={handleCreate}>
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label className="form-label" htmlFor="qr-input">QR Code Data</label>
                  <textarea
                    id="qr-input"
                    className="input textarea"
                    rows={4}
                    value={qrInput}
                    onChange={e => setQrInput(e.target.value)}
                    placeholder='{"subject_code": "CS301", "bundle_number": "B-07", "total_sheets": 30}'
                    style={{ fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }}
                  />
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    Paste the decoded QR JSON string above.
                  </p>
                </div>

                <button
                  id="create-bundle-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%', padding: '13px' }}
                >
                  {loading ? <><LoadingSpinner size="sm" /> Creating Bundle...</> : '🚀 Start Bundle Session'}
                </button>
              </form>

              <div className="divider" />

              <div>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  Example QR data format:
                </p>
                <pre style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px', padding: '12px',
                  fontSize: '12px', color: '#94a3b8',
                  overflowX: 'auto', whiteSpace: 'pre-wrap',
                }}>
                  {sampleQR}
                </pre>
                <button
                  id="use-sample-btn"
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setQrInput(sampleQR)}
                  style={{ marginTop: '8px', padding: '6px 14px', fontSize: '12px' }}
                >
                  Use Sample
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
