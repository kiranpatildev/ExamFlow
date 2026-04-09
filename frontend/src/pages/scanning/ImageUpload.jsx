import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { uploadImage, finalizeSheet } from '../../api/answerSheets';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import CameraCapture from '../../components/CameraCapture';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

/**
 * ImageUpload — Step 2 of scanning flow.
 *
 * Correct upload flow (matching the backend):
 *   1. For each captured page:
 *        POST /api/answer-sheets/upload-image/
 *        Body: { bundle_id, roll_number, image }
 *        Response: { image_id }    ← collect these
 *
 *   2. After all pages uploaded, finalize:
 *        POST /api/answer-sheets/finalize/
 *        Body: { bundle_id, roll_number, image_ids: [int...] }
 *        Response: { answer_sheet_id, pdf_url }  ← PDF compiled
 *
 * Note: We use manual roll number entry (no barcode detection),
 * so is_first_page is NOT sent (defaults to false on the backend).
 */
export default function ImageUpload() {
  const { bundleId } = useParams();
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const [rollNumber, setRollNumber] = useState('');
  const [capturedPages, setCapturedPages] = useState([]); // { blob, filename, preview }
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [completedSheets, setCompletedSheets] = useState([]);

  // Called by CameraCapture for each page image
  const handleCapture = (blob, filename) => {
    const preview = URL.createObjectURL(blob);
    setCapturedPages(prev => [...prev, { blob, filename, preview }]);
  };

  const removePage = (idx) => {
    setCapturedPages(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const clearPages = () => {
    capturedPages.forEach(p => URL.revokeObjectURL(p.preview));
    setCapturedPages([]);
  };

  const handleUploadSheet = async () => {
    if (!rollNumber.trim()) { toast.error('Enter the student roll number first.'); return; }
    if (capturedPages.length === 0) { toast.error('Capture at least one page first.'); return; }

    setUploading(true);
    const imageIds = [];

    try {
      // Step 1 — Upload each page image individually
      for (let i = 0; i < capturedPages.length; i++) {
        const { blob, filename } = capturedPages[i];
        setUploadProgress(`Uploading page ${i + 1} of ${capturedPages.length}...`);

        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        const formData = new FormData();
        formData.append('bundle_id', bundleId);
        formData.append('roll_number', rollNumber.trim());
        formData.append('image', file);
        // NOT sending is_first_page → defaults to false → no barcode scan needed

        const res = await uploadImage(formData);
        imageIds.push(res.data.image_id); // backend returns { image_id: int }
      }

      // Step 2 — Finalize: compile all pages into one PDF
      setUploadProgress('Compiling pages into PDF...');
      const finalRes = await finalizeSheet({
        bundle_id: parseInt(bundleId, 10),
        roll_number: rollNumber.trim(),
        image_ids: imageIds,
      });

      setCompletedSheets(prev => [...prev, {
        rollNumber: rollNumber.trim(),
        pageCount: capturedPages.length,
        sheetId: finalRes.data.answer_sheet_id,
      }]);

      toast.success(`Roll ${rollNumber} — PDF compiled (${capturedPages.length} pages)`);
      clearPages();
      setRollNumber('');
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.roll_number?.[0] ||
        err.response?.data?.image_ids?.[0] ||
        'Upload failed. Please try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="main-layout">
      <AppSidebar role="scanning_staff" userName={auth?.fullName || 'Staff'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Scan Answer Sheets</h1>
              <p>Bundle #{bundleId} — Capture images for each student's answer sheet.</p>
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
            {/* ── Left: form ── */}
            <div>
              {/* Roll number */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="roll-number">Student Roll Number *</label>
                <input
                  id="roll-number"
                  className="input"
                  value={rollNumber}
                  onChange={e => setRollNumber(e.target.value)}
                  placeholder="e.g. 228089"
                  disabled={uploading}
                />
                <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '5px' }}>
                  Enter this before capturing pages. One roll number per sheet.
                </p>
              </div>

              {/* Camera source selector */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ marginBottom: '16px' }}>Step 1 — Capture Pages</h3>
                <CameraCapture onCapture={handleCapture} disabled={uploading} />
              </div>

              {/* Captured pages preview */}
              {capturedPages.length > 0 && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3>
                      Step 2 — Review Pages
                      <span style={{
                        marginLeft: '8px', fontSize: '12px', fontWeight: 500,
                        background: '#ebf8ff', border: '1px solid #bee3f8',
                        color: '#2b6cb0', padding: '2px 8px', borderRadius: '999px',
                      }}>
                        {capturedPages.length} page{capturedPages.length !== 1 ? 's' : ''}
                      </span>
                    </h3>
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={clearPages}>
                      Clear All
                    </button>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                    gap: '10px', marginBottom: '16px',
                  }}>
                    {capturedPages.map((page, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img
                          src={page.preview}
                          alt={`Page ${i + 1}`}
                          style={{
                            width: '100%', aspectRatio: '3/4', objectFit: 'cover',
                            borderRadius: '8px', border: '2px solid var(--color-border)',
                            display: 'block',
                          }}
                        />
                        <div style={{
                          position: 'absolute', top: '4px', left: '4px',
                          background: '#1a202c', color: '#fff',
                          borderRadius: '4px', padding: '2px 6px',
                          fontSize: '11px', fontWeight: 700,
                        }}>
                          P{i + 1}
                        </div>
                        <button
                          onClick={() => removePage(i)}
                          disabled={uploading}
                          style={{
                            position: 'absolute', top: '4px', right: '4px',
                            background: 'rgba(229,62,62,0.92)', color: '#fff',
                            border: 'none', borderRadius: '4px',
                            width: '22px', height: '22px',
                            cursor: 'pointer', fontSize: '13px', lineHeight: 1,
                          }}
                        >✕</button>
                      </div>
                    ))}
                  </div>

                  {uploading && uploadProgress && (
                    <div style={{
                      background: '#ebf8ff', border: '1px solid #bee3f8',
                      borderRadius: '6px', padding: '10px 14px',
                      fontSize: '13px', color: '#2b6cb0',
                      marginBottom: '12px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <LoadingSpinner size="sm" /> {uploadProgress}
                    </div>
                  )}

                  <button
                    id="upload-sheet-btn"
                    className="btn btn-primary"
                    onClick={handleUploadSheet}
                    disabled={uploading || !rollNumber.trim()}
                    style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                  >
                    {uploading
                      ? <><LoadingSpinner size="sm" /> Processing...</>
                      : `⬆ Upload Sheet — Roll ${rollNumber || '?'} (${capturedPages.length} pages)`}
                  </button>
                </div>
              )}

              {capturedPages.length === 0 && !uploading && (
                <div style={{
                  textAlign: 'center', padding: '24px',
                  background: '#f8fafc', border: '1px dashed var(--color-border)',
                  borderRadius: '10px', color: 'var(--color-text-muted)',
                }}>
                  <div style={{ fontSize: '28px', opacity: 0.35 }}>👆</div>
                  <p style={{ marginTop: '8px', fontSize: '13px' }}>
                    Choose a camera source above and capture each page, then click Upload.
                  </p>
                </div>
              )}
            </div>

            {/* ── Right: sidebar ── */}
            <div>
              <div className="card" style={{ position: 'sticky', top: '20px' }}>
                <h3 style={{ marginBottom: '16px' }}>
                  Completed Sheets
                  <span style={{
                    marginLeft: '8px', fontSize: '12px', fontWeight: 500,
                    background: '#f0fff4', border: '1px solid #c6f6d5',
                    color: '#276749', padding: '2px 8px', borderRadius: '999px',
                  }}>
                    {completedSheets.length}
                  </span>
                </h3>

                {completedSheets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-text-dim)' }}>
                    <div style={{ fontSize: '28px', opacity: 0.3 }}>📄</div>
                    <p style={{ fontSize: '13px', marginTop: '6px' }}>
                      Uploaded sheets appear here.
                    </p>
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
                            {s.pageCount} page{s.pageCount !== 1 ? 's' : ''} • PDF ready
                          </p>
                        </div>
                        <span className="badge badge-success">✓</span>
                      </div>
                    ))}
                    <button
                      id="go-review-btn"
                      className="btn btn-primary"
                      onClick={() => navigate(`/scanning/review/${bundleId}`)}
                      style={{ width: '100%', marginTop: '14px' }}
                    >
                      Review & Submit →
                    </button>
                  </>
                )}
              </div>

              <div className="card" style={{ marginTop: '14px', padding: '14px' }}>
                <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>💡 Tips</p>
                <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 2 }}>
                  <li>Enter roll number before capturing pages</li>
                  <li>Capture pages in order (front to back)</li>
                  <li>USB cameras appear in device list automatically</li>
                  <li>Phone cameras: use IP Webcam app on same Wi-Fi</li>
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
