import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBundle } from '../../api/bundles';
import { getSubjects } from '../../api/markingSchemes';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

/**
 * SessionCreate — Step 1 of scanning flow.
 *
 * The backend BundleCreateSerializer expects `qr_raw_data` as a JSON STRING
 * with keys: { subject_code, bundle_number, total_sheets }.
 *
 * We select the subject (to get subject_code), enter bundle_number and
 * total_sheets, then JSON.stringify them before posting.
 */
export default function SessionCreate() {
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [bundleNumber, setBundleNumber] = useState('');
  const [totalSheets, setTotalSheets] = useState('');
  const [creating, setCreating] = useState(false);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getSubjects()
      .then(res => {
        const list = res.data.results || res.data || [];
        setSubjects(list);
      })
      .catch(() => toast.error('Could not load subjects.'))
      .finally(() => setLoadingSubjects(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedSubject) { toast.error('Please select a subject.'); return; }
    if (!bundleNumber.trim()) { toast.error('Please enter a bundle number.'); return; }
    const sheets = parseInt(totalSheets, 10);
    if (!sheets || sheets <= 0) { toast.error('Enter a valid total sheet count.'); return; }

    setCreating(true);
    try {
      // Backend expects a raw JSON string — it parses it internally
      const qrJson = JSON.stringify({
        subject_code: selectedSubject.subject_code,
        bundle_number: bundleNumber.trim(),
        total_sheets: sheets,
      });
      const res = await createBundle(qrJson);
      toast.success(`Bundle "${bundleNumber}" created!`);
      navigate(`/scanning/upload/${res.data.id}`);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.qr_raw_data?.[0] ||
        'Failed to create bundle.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const steps = [
    { n: '1', icon: '📋', title: 'Create Bundle',  desc: 'Fill in subject and bundle details', active: true },
    { n: '2', icon: '📷', title: 'Scan Sheets',    desc: 'Capture each student\'s answer sheet' },
    { n: '3', icon: '✅', title: 'Submit Bundle',  desc: 'Review and submit to exam dept' },
  ];

  return (
    <div className="main-layout">
      <AppSidebar role="scanning_staff" userName={auth?.fullName || 'Staff'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Create New Bundle</h1>
              <p>Set up a bundle before you start scanning answer sheets.</p>
            </div>
          </div>

          {/* Progress steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '28px' }}>
            {steps.map(s => (
              <div key={s.n} className="card" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '16px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: s.active ? '#1a202c' : '#edf2f7',
                  color:      s.active ? '#ffffff' : '#a0aec0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '14px',
                }}>{s.n}</div>
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '2px' }}>{s.icon} {s.title}</p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="card" style={{ maxWidth: '540px' }}>
            <h3 style={{ marginBottom: '20px' }}>Bundle Details</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label" htmlFor="subject-select">Subject *</label>
                {loadingSubjects ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '13px', padding: '10px 0' }}>
                    <LoadingSpinner size="sm" /> Loading subjects...
                  </div>
                ) : (
                  <select
                    id="subject-select"
                    className="select"
                    value={selectedSubject?.id || ''}
                    onChange={e => setSelectedSubject(subjects.find(s => String(s.id) === e.target.value) || null)}
                  >
                    <option value="">— Select a subject —</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.subject_code} — {s.subject_name} (Sem {s.semester})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bundle-number">Bundle Number *</label>
                <input
                  id="bundle-number"
                  className="input"
                  value={bundleNumber}
                  onChange={e => setBundleNumber(e.target.value)}
                  placeholder="e.g. BND-2024-001"
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="total-sheets">Total Answer Sheets in Bundle *</label>
                <input
                  id="total-sheets"
                  className="input"
                  type="number"
                  min="1"
                  max="500"
                  value={totalSheets}
                  onChange={e => setTotalSheets(e.target.value)}
                  placeholder="e.g. 60"
                />
                <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '4px' }}>
                  Total number of student papers in this physical bundle.
                </p>
              </div>

              <button
                id="create-bundle-btn"
                type="submit"
                className="btn btn-primary"
                disabled={creating}
                style={{ width: '100%', padding: '11px', marginTop: '4px', fontSize: '15px' }}
              >
                {creating
                  ? <><LoadingSpinner size="sm" /> Creating...</>
                  : 'Create Bundle & Start Scanning →'}
              </button>
            </form>
          </div>
        </div>

        <footer className="main-footer">
          <span>© 2024 ExamFlow. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}
