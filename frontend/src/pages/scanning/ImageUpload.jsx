import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { uploadImage, finalizeSheet } from '../../api/answerSheets';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import CameraCapture from '../../components/CameraCapture';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ImageUpload() {
  const { bundleId } = useParams();
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  // Current sheet being assembled
  const [rollNumber, setRollNumber] = useState('');
  const [capturedPages, setCapturedPages] = useState([]); // { blob, filename, preview }
  const [uploading, setUploading] = useState(false);

  // Completed sheets in this session
  const [completedSheets, setCompletedSheets] = useState([]);

  // Called by CameraCapture for each captured/selected image
  const handleCapture = (blob, filename) => {
    const preview = URL.createObjectURL(blob);
    setCapturedPages(prev => [...prev, { blob, filename, preview }]);
  };

  const removePage = (i) => {
    setCapturedPages(prev => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const handleUploadSheet = async () => {
    if (!rollNumber.trim()) { toast.error('Enter the student roll number first.'); return; }
    if (capturedPages.length === 0) { toast.error('Capture at least one page first.'); return; }

    setUploading(true);
    try {
      let sheetId = null;
      for (let i = 0; i < capturedPages.length; i++) {
        const { blob, filename } = capturedPages[i];
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        const formData = new FormData();
        formData.append('bundle_id', bundleId);
        formData.append('roll_number', rollNumber.trim());
        formData.append('image', file);
        formData.append('page_number', i + 1);
        const res = await uploadImage(formData);
        sheetId = res.data.answer_sheet_id;
      }

      // Compile all pages into a PDF
      await finalizeSheet(sheetId);

      setCompletedSheets(prev => [...prev, {
        rollNumber: rollNumber.trim(),
        pageCount: capturedPages.length,
        sheetId,
      }]);

      toast.success(`Sheet for Roll ${rollNumber} uploaded & compiled!`);

      // Clear for next sheet
      capturedPages.forEach(p => URL.revokeObjectURL(p.preview));
      setRollNumber('');
      setCapturedPages([]);
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.roll_number?.[0]
        || 'Upload failed. Please try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="main-layout">
      <AppSidebar role="scanning_staff" userName={auth?.fullName || 'Staff'} logout={logout} />

      <div className="main-content">
        <div className="content-body">

          {/* Header */}
          <div className="page-header">
            <div className="page-header-left">
              <h1>Upload Answer Sheets</h1>
              <p>Bundle #{bundleId} — Capture or upload images for each student's answer sheet.</p>
            </div>
            <button
              id="review-btn"
              className="btn btn-primary"
              onClick={() => navigate(`/scanning/review/${bundleId}`)}
              disabled={completedSheets.length === 0}
            >
              Review & Submit ({completedSheets.length}) →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>

            {/* Left — main capture area */}
            <div>
              {/* Roll number */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="roll-number">
                  Student Roll Number *
                </label>
                <input
                  id="roll-number"
                  className="input"
                  value={rollNumber}
                  onChange={e => setRollNumber(e.target.value)}
                  placeholder="e.g. 228089"
                  disabled={uploading}
                />
                <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '6px' }}>
                  Enter the roll number before capturing pages.
                </p>
              </div>

              {/* Camera / source selector */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ marginBottom: '16px' }}>Step 1 — Capture Pages</h3>
                <CameraCapture onCapture={handleCapture} disabled={uploading} />
              </div>

              {/* Captured pages preview */}
              {capturedPages.length > 0 && (
                <div className="card" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3>
                      Step 2 — Review Pages
                      <span style={{
                        marginLeft: '8px', fontSize: '12px', fontWeight: 500,
                        background: '#ebf8ff', color: '#2b6cb0',
                        border: '1px solid #bee3f8',
                        padding: '2px 8px', borderRadius: '999px',
                      }}>
                        {capturedPages.length} page{capturedPages.length !== 1 ? 's' : ''}
                      </span>
                    </h3>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => { capturedPages.forEach(p => URL.revokeObjectURL(p.preview)); setCapturedPages([]); }}
                    >
                      Clear All
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                    {capturedPages.map((page, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img
                          src={page.preview}
                          alt={`Page ${i + 1}`}
                          style={{
                            width: '100%', aspectRatio: '3/4', objectFit: 'cover',
                            borderRadius: '8px', border: '1px solid var(--color-border)',
                          }}
                        />
                        <div style={{
                          position: 'absolute', top: '4px', left: '4px',
                          background: '#1a202c', color: '#fff',
                          borderRadius: '4px', padding: '2px 6px',
                          fontSize: '11px', fontWeight: 600,
                        }}>
                          P{i + 1}
                        </div>
                        <button
                          onClick={() => removePage(i)}
                          style={{
                            position: 'absolute', top: '4px', right: '4px',
                            background: 'rgba(229,62,62,0.9)', color: '#fff',
                            border: 'none', borderRadius: '4px',
                            width: '22px', height: '22px',
                            cursor: 'pointer', fontSize: '12px', lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Upload button */}
                  <button
                    id="upload-sheet-btn"
                    className="btn btn-primary"
                    onClick={handleUploadSheet}
                    disabled={uploading || !rollNumber.trim() || capturedPages.length === 0}
                    style={{ width: '100%', padding: '12px', marginTop: '16px', fontSize: '15px' }}
                  >
                    {uploading
                      ? <><LoadingSpinner size="sm" /> Uploading & Compiling PDF...</>
                      : `⬆ Upload Sheet — Roll ${rollNumber || '?'} (${capturedPages.length} pages)`}
                  </button>
                </div>
              )}

              {/* Empty call-to-action if nothing captured yet */}
              {capturedPages.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '24px', background: '#f8fafc',
                  border: '1px dashed var(--color-border)', borderRadius: '10px',
                  color: 'var(--color-text-muted)',
                }}>
                  <span style={{ fontSize: '28px', opacity: 0.4 }}>👆</span>
                  <p style={{ marginTop: '8px', fontSize: '13px' }}>
                    Choose a source above and capture pages. Then click Upload.
                  </p>
                </div>
              )}
            </div>

            {/* Right — completed sheets sidebar */}
            <div>
              <div className="card" style={{ position: 'sticky', top: '20px' }}>
                <h3 style={{ marginBottom: '16px' }}>
                  Completed Sheets
                  <span style={{
                    marginLeft: '8px', fontSize: '12px', fontWeight: 500,
                    background: '#f0fff4', color: '#276749',
                    border: '1px solid #c6f6d5',
                    padding: '2px 8px', borderRadius: '999px',
                  }}>
                    {completedSheets.length}
                  </span>
                </h3>

                {completedSheets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-dim)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px', opacity: 0.35 }}>📄</div>
                    <p style={{ fontSize: '13px' }}>Sheets will appear here after upload.</p>
                  </div>
                ) : (
                  <>
                    {completedSheets.map((s, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: i < completedSheets.length - 1 ? '1px solid var(--color-border-2)' : 'none',
                      }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '14px' }}>Roll {s.rollNumber}</p>
                          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {s.pageCount} page{s.pageCount !== 1 ? 's' : ''} • PDF compiled
                          </p>
                        </div>
                        <span className="badge badge-success">✓</span>
                      </div>
                    ))}

                    <button
                      id="go-review-btn"
                      className="btn btn-primary"
                      onClick={() => navigate(`/scanning/review/${bundleId}`)}
                      style={{ width: '100%', marginTop: '16px' }}
                    >
                      Review & Submit →
                    </button>
                  </>
                )}
              </div>

              {/* Tips card */}
              <div className="card" style={{ marginTop: '16px', padding: '16px' }}>
                <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>💡 Tips</p>
                <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 2 }}>
                  <li>Capture pages in order (front to back)</li>
                  <li>Ensure the barcode on page 1 is visible</li>
                  <li>Good lighting = better barcode detection</li>
                  <li>USB cameras appear in the camera selector</li>
                  <li>Phone cameras: use IP Webcam app</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <footer className="main-footer">
          <span>© 2024 ExamFlow. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}
