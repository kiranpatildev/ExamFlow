/**
 * ImageUpload — Answer Sheet Scanning Page
 *
 * Flow per student:
 *   1. Staff captures page 1 (which has the barcode/roll-number on it).
 *   2. Image is immediately uploaded to backend with is_first_page=true.
 *   3. Backend runs barcode detection → returns { image_id, roll_number }.
 *   4. Detected roll number is shown as a read-only confirmation badge.
 *   5. Staff captures each remaining page → uploaded immediately,
 *      each returning an image_id.
 *   6. "Finalise Sheet" → POST { bundle_id, roll_number, image_ids[] }
 *      → backend compiles PDF named after the roll number.
 *   7. Reset for next student.
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { uploadImage, finalizeSheet } from '../../api/answerSheets';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import CameraCapture from '../../components/CameraCapture';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

/* ─── ui state machine ─────────────────────────────────────────────────────
   'idle'         → waiting for page-1 capture
   'detecting'    → uploading page 1, waiting for barcode result
   'barcode_fail' → backend could not detect barcode — ask to recapture
   'pages'        → roll number confirmed, capturing subsequent pages
   'finalising'   → uploading remaining pages + calling /finalize/
──────────────────────────────────────────────────────────────────────────── */

export default function ImageUpload() {
  const { bundleId } = useParams();
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  // ── per-sheet state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState('idle');      // 'idle' | 'detecting' | 'barcode_fail' | 'pages' | 'finalising'
  const [detectedRoll, setDetectedRoll] = useState('');
  // Track every image_id returned by the backend (in upload order)
  const [imageIds, setImageIds] = useState([]);    // [number, ...]
  // Local preview thumbnails (for UI only — not sent to backend again)
  const [pages, setPages] = useState([]);          // [{ preview, pageNum }]

  // ── session-level completed sheets ──────────────────────────────────────
  const [completedSheets, setCompletedSheets] = useState([]);

  // ── reset for next student ───────────────────────────────────────────────
  const resetSheet = useCallback(() => {
    // Revoke all preview object URLs to free memory
    pages.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhase('idle');
    setDetectedRoll('');
    setImageIds([]);
    setPages([]);
  }, [pages]);

  // ── helper to upload one image blob ─────────────────────────────────────
  const uploadBlob = async (blob, filename, extraFields = {}) => {
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
    const fd = new FormData();
    fd.append('bundle_id', bundleId);
    fd.append('image', file);
    Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v));
    const res = await uploadImage(fd);
    return res.data; // { image_id, roll_number? }
  };

  // ── CameraCapture callback ───────────────────────────────────────────────
  const handleCapture = useCallback(async (blob, filename) => {
    const isFirstPage = phase === 'idle' || phase === 'barcode_fail';

    if (isFirstPage) {
      // ── PAGE 1: detect barcode ──────────────────────────────────────────
      setPhase('detecting');
      const preview = URL.createObjectURL(blob);
      try {
        const data = await uploadBlob(blob, filename, { is_first_page: 'true' });
        // data = { image_id: number, roll_number: string }
        const roll = data.roll_number;
        setDetectedRoll(roll);
        setImageIds([data.image_id]);
        setPages([{ preview, pageNum: 1 }]);
        setPhase('pages');
        toast.success(`Barcode detected — Roll ${roll}`);
      } catch (err) {
        URL.revokeObjectURL(preview);
        const msg = err.response?.data?.error || 'Barcode not detected. Re-capture page 1 clearly.';
        toast.error(msg);
        setPhase('barcode_fail');
      }
    } else if (phase === 'pages') {
      // ── SUBSEQUENT PAGES: just upload with known roll number ────────────
      const pageNum = pages.length + 1;
      const preview = URL.createObjectURL(blob);
      try {
        const data = await uploadBlob(blob, filename, {
          roll_number: detectedRoll,
          is_first_page: 'false',
        });
        setImageIds((prev) => [...prev, data.image_id]);
        setPages((prev) => [...prev, { preview, pageNum }]);
        toast.success(`Page ${pageNum} captured`);
      } catch (err) {
        URL.revokeObjectURL(preview);
        const msg = err.response?.data?.error || `Failed to upload page ${pageNum}. Try again.`;
        toast.error(msg);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, detectedRoll, pages, bundleId]);

  // ── remove a non-first page (first page cannot be removed without resetting)
  const removePage = useCallback(async (idx) => {
    // idx 0 = page 1 (barcode page) — removing it resets the whole sheet
    if (idx === 0) {
      if (!window.confirm('Removing page 1 will reset the current sheet. Continue?')) return;
      resetSheet();
      return;
    }
    // For subsequent pages we issue a DELETE to the backend temp image
    const imageId = imageIds[idx];
    try {
      // Silently call delete on backend — ignore if it fails (UI still removes)
      // (The import is available as deleteImage in api/answerSheets.js)
      const { deleteImage } = await import('../../api/answerSheets');
      await deleteImage(imageId);
    } catch { /* non-blocking */ }

    URL.revokeObjectURL(pages[idx].preview);
    setPages((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, pageNum: i + 1 })));
    setImageIds((prev) => prev.filter((_, i) => i !== idx));
  }, [imageIds, pages, resetSheet]);

  // ── finalise the current sheet ───────────────────────────────────────────
  const handleFinalise = async () => {
    if (imageIds.length === 0) { toast.error('No pages uploaded yet.'); return; }
    setPhase('finalising');
    try {
      await finalizeSheet({
        bundle_id: parseInt(bundleId, 10),
        roll_number: detectedRoll,
        image_ids: imageIds,
      });

      setCompletedSheets((prev) => [
        ...prev,
        { rollNumber: detectedRoll, pageCount: imageIds.length },
      ]);
      toast.success(`Sheet for Roll ${detectedRoll} — PDF compiled ✓`);
      pages.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhase('idle');
      setDetectedRoll('');
      setImageIds([]);
      setPages([]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Finalisation failed. Please retry.';
      toast.error(msg);
      setPhase('pages'); // allow retry
    }
  };

  // ── derived flags ─────────────────────────────────────────────────────────
  const scannerDisabled = phase === 'detecting' || phase === 'finalising';

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="main-layout">
      <AppSidebar role="scanning_staff" userName={auth?.fullName || 'Staff'} logout={logout} />

      <div className="main-content">
        <div className="content-body">

          {/* Header */}
          <div className="page-header">
            <div className="page-header-left">
              <h1>Scan Answer Sheets</h1>
              <p>Bundle #{bundleId} — use the camera to capture each page of each student's answer sheet.</p>
            </div>
            <button
              id="review-btn"
              className="btn btn-primary"
              onClick={() => navigate(`/scanning/review/${bundleId}`)}
              disabled={completedSheets.length === 0}
            >
              Review &amp; Submit ({completedSheets.length}) →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>

            {/* ── LEFT: current sheet ── */}
            <div>

              {/* Phase guidance banner */}
              {(phase === 'idle' || phase === 'barcode_fail') && (
                <div style={{
                  padding: '14px 18px', marginBottom: '16px',
                  background: phase === 'barcode_fail' ? 'var(--color-danger-bg)' : 'var(--color-info-bg)',
                  border: `1px solid ${phase === 'barcode_fail' ? 'var(--color-danger-b)' : 'var(--color-info-b)'}`,
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                }}
                  className="fade-in-up"
                >
                  <span style={{ fontSize: '22px' }}>
                    {phase === 'barcode_fail' ? '⚠️' : '🔲'}
                  </span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px' }}>
                      {phase === 'barcode_fail'
                        ? 'Barcode not detected — please retry page 1'
                        : 'Step 1 — Capture the FIRST page'}
                    </p>
                    <p style={{ fontSize: '12px', marginTop: '2px', opacity: 0.85 }}>
                      {phase === 'barcode_fail'
                        ? 'Ensure the barcode is fully in frame and well-lit, then capture again.'
                        : 'Page 1 must have the student barcode. The roll number will be read automatically.'}
                    </p>
                  </div>
                </div>
              )}

              {phase === 'detecting' && (
                <div style={{
                  padding: '14px 18px', marginBottom: '16px',
                  background: 'var(--color-info-bg)', border: '1px solid var(--color-info-b)',
                  borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <LoadingSpinner size="sm" />
                  <p style={{ fontWeight: 600, fontSize: '14px' }}>Reading barcode…</p>
                </div>
              )}

              {(phase === 'pages' || phase === 'finalising') && (
                <div style={{
                  padding: '14px 18px', marginBottom: '16px',
                  background: 'var(--color-success-bg)', border: '1px solid var(--color-success-b)',
                  borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '14px',
                }}
                  className="fade-in-up"
                >
                  <span style={{ fontSize: '22px' }}>✅</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-success)' }}>
                      Roll Number Detected
                    </p>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: '#276749', lineHeight: 1.2 }}>
                      {detectedRoll}
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                    onClick={resetSheet}
                    disabled={phase === 'finalising'}
                  >
                    ↩ Wrong roll? Reset
                  </button>
                </div>
              )}

              {/* Camera capture card */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ marginBottom: '4px' }}>
                  {phase === 'idle' || phase === 'barcode_fail'
                    ? '📷 Capture Page 1 (Barcode Page)'
                    : `📷 Capture Page ${pages.length + 1}`}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                  {phase === 'idle' || phase === 'barcode_fail'
                    ? 'Make sure the student barcode is clearly visible and centred in the frame.'
                    : 'Continue capturing remaining pages in order (front to back).'}
                </p>
                <CameraCapture onCapture={handleCapture} disabled={scannerDisabled} />
              </div>

              {/* Pages captured so far */}
              {pages.length > 0 && (
                <div className="card fade-in-up" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3>
                      Current Sheet: Roll {detectedRoll}
                      <span style={{
                        marginLeft: '8px', fontSize: '12px', fontWeight: 500,
                        background: '#ebf8ff', color: '#2b6cb0',
                        border: '1px solid #bee3f8', padding: '2px 8px', borderRadius: '999px',
                      }}>
                        {pages.length} page{pages.length !== 1 ? 's' : ''} captured
                      </span>
                    </h3>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={resetSheet}
                      disabled={scannerDisabled}
                    >
                      Discard Sheet
                    </button>
                  </div>

                  {/* Thumbnail grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    {pages.map((page, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img
                          src={page.preview}
                          alt={`Page ${page.pageNum}`}
                          style={{
                            width: '100%', aspectRatio: '3/4', objectFit: 'cover',
                            borderRadius: '8px',
                            border: i === 0
                              ? '2px solid var(--color-success)'
                              : '1px solid var(--color-border)',
                          }}
                        />
                        {/* Page number badge */}
                        <div style={{
                          position: 'absolute', top: '4px', left: '4px',
                          background: i === 0 ? 'var(--color-success)' : '#1a202c',
                          color: '#fff', borderRadius: '4px', padding: '2px 6px',
                          fontSize: '10px', fontWeight: 700,
                        }}>
                          {i === 0 ? '🔲 P1' : `P${page.pageNum}`}
                        </div>
                        {/* Remove button */}
                        {!scannerDisabled && (
                          <button
                            onClick={() => removePage(i)}
                            title="Remove this page"
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
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Finalise button */}
                  <button
                    id="finalise-sheet-btn"
                    className="btn btn-primary"
                    onClick={handleFinalise}
                    disabled={scannerDisabled || pages.length === 0}
                    style={{ width: '100%', padding: '13px', fontSize: '15px' }}
                  >
                    {phase === 'finalising'
                      ? <><LoadingSpinner size="sm" /> Compiling PDF…</>
                      : `✅ Finish this sheet`}
                  </button>
                </div>
              )}

              {/* Empty state — waiting for first capture */}
              {pages.length === 0 && phase !== 'detecting' && (
                <div style={{
                  textAlign: 'center', padding: '28px',
                  background: '#f8fafc', border: '1px dashed var(--color-border)',
                  borderRadius: '10px', color: 'var(--color-text-muted)',
                }}>
                  <span style={{ fontSize: '32px', opacity: 0.4 }}>📸</span>
                  <p style={{ marginTop: '8px', fontSize: '13px' }}>
                    {phase === 'barcode_fail'
                      ? 'Re-capture page 1 with the barcode clearly visible.'
                      : 'Start the camera above and capture page 1.'}
                  </p>
                </div>
              )}
            </div>

            {/* ── RIGHT: completed sheets sidebar ── */}
            <div>
              <div className="card" style={{ position: 'sticky', top: '20px' }}>
                <h3 style={{ marginBottom: '16px' }}>
                  Completed Sheets
                  <span style={{
                    marginLeft: '8px', fontSize: '12px', fontWeight: 500,
                    background: '#f0fff4', color: '#276749',
                    border: '1px solid #c6f6d5', padding: '2px 8px', borderRadius: '999px',
                  }}>
                    {completedSheets.length}
                  </span>
                </h3>

                {completedSheets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-dim)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px', opacity: 0.35 }}>📄</div>
                    <p style={{ fontSize: '13px' }}>Completed sheets will appear here.</p>
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
                          <p style={{ fontWeight: 700, fontSize: '14px' }}>Roll {s.rollNumber}</p>
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
                      Review &amp; Submit →
                    </button>
                  </>
                )}
              </div>

              {/* Tips */}
              <div className="card" style={{ marginTop: '16px', padding: '16px' }}>
                <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>💡 Tips</p>
                <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 2 }}>
                  <li>Page 1 must have the student's barcode</li>
                  <li>Remaining pages are captured in order</li>
                  <li>Good lighting → faster barcode detection</li>
                  <li>USB cameras appear in the camera selector</li>
                  <li>Phone camera: use IP Webcam mode</li>
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
 
