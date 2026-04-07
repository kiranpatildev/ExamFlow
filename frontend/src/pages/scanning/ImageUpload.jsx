import { useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { uploadImage, deleteImage, finalizeAnswerSheet } from '../../api/answerSheets';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';

export default function ImageUpload() {
  const { bundleId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const bundle = state?.bundle;

  const [currentRollNumber, setCurrentRollNumber] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);  // [{ id, name }]
  const [finalizedSheets, setFinalizedSheets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  const isFirstPage = uploadedImages.length === 0;

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('bundle_id', bundleId);
    formData.append('image', file);
    formData.append('is_first_page', isFirstPage ? 'true' : 'false');
    if (!isFirstPage && currentRollNumber) {
      formData.append('roll_number', currentRollNumber);
    }

    try {
      const res = await uploadImage(formData);
      const { image_id, roll_number } = res.data;
      if (isFirstPage) setCurrentRollNumber(roll_number);
      setUploadedImages(prev => [...prev, { id: image_id, name: file.name }]);
      toast.success(isFirstPage ? `Roll detected: ${roll_number}` : `Page ${uploadedImages.length + 1} uploaded`);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || 'Upload failed.';
      if (status === 413) setError('Image too large (max 10 MB).');
      else if (status === 415) setError('Only JPEG and PNG images are accepted.');
      else setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await deleteImage(imageId);
      setUploadedImages(prev => prev.filter(img => img.id !== imageId));
      if (uploadedImages.length === 1) setCurrentRollNumber(null);
      toast.success('Image removed.');
    } catch {
      toast.error('Failed to remove image.');
    }
  };

  const handleFinalize = async () => {
    if (uploadedImages.length === 0) {
      setError('Upload at least one image before finalizing.');
      return;
    }
    setFinalizing(true);
    setError('');
    try {
      const res = await finalizeAnswerSheet({
        bundle_id: parseInt(bundleId),
        roll_number: currentRollNumber,
        image_ids: uploadedImages.map(i => i.id),
      });
      setFinalizedSheets(prev => [...prev, { roll_number: currentRollNumber, id: res.data.answer_sheet_id }]);
      setUploadedImages([]);
      setCurrentRollNumber(null);
      toast.success(`Answer sheet ${currentRollNumber} finalized!`);
    } catch (err) {
      setError(err.response?.data?.error || 'Finalization failed.');
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="page-wrapper">
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)', flexShrink: 0,
      }}>
        <div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '18px', color: '#10b981' }}>
            📷 Upload Answer Sheet Images
          </span>
          {bundle && (
            <span style={{ marginLeft: '16px', fontSize: '13px', color: '#64748b' }}>
              Bundle #{bundle.bundle_number} — {bundle.subject?.subject_code}
            </span>
          )}
        </div>
        <button
          id="review-bundle-btn"
          className="btn btn-primary"
          onClick={() => navigate(`/scanning/review/${bundleId}`, { state: { bundle, finalizedSheets } })}
          style={{ padding: '8px 18px' }}
        >
          Review & Submit →
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', gap: '0', overflow: 'hidden' }}>
        {/* Left: Upload area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          {/* Current session */}
          <div className="card fade-in-up" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ marginBottom: '4px' }}>
                  {currentRollNumber ? `Roll: ${currentRollNumber}` : 'New Answer Sheet'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px' }}>
                  {isFirstPage
                    ? 'Upload the FIRST page — barcode will be detected automatically.'
                    : `Page ${uploadedImages.length + 1} — additional pages for roll ${currentRollNumber}`}
                </p>
              </div>
              <span style={{
                padding: '4px 12px', borderRadius: '999px', fontSize: '12px',
                background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 600,
              }}>
                {uploadedImages.length} page{uploadedImages.length !== 1 ? 's' : ''} buffered
              </span>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Upload zone */}
            <div
              className="upload-zone"
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="image-file-input"
                accept="image/jpeg,image/png"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <LoadingSpinner size="lg" />
                  <span style={{ color: '#94a3b8' }}>Uploading & detecting barcode...</span>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
                  <p style={{ color: '#94a3b8', marginBottom: '6px' }}>
                    Click to upload {isFirstPage ? '(first page)' : '(next page)'}
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>JPEG or PNG • Max 10 MB</p>
                </div>
              )}
            </div>

            {/* Uploaded pages list */}
            {uploadedImages.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Buffered pages:</p>
                {uploadedImages.map((img, i) => (
                  <div key={img.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px', marginBottom: '4px',
                  }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      Page {i + 1}: {img.name}
                    </span>
                    <button
                      id={`delete-img-${img.id}`}
                      className="btn btn-danger"
                      style={{ padding: '3px 10px', fontSize: '12px' }}
                      onClick={() => handleDeleteImage(img.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Finalize button */}
            {uploadedImages.length > 0 && (
              <button
                id="finalize-sheet-btn"
                className="btn btn-success"
                onClick={handleFinalize}
                disabled={finalizing}
                style={{ width: '100%', marginTop: '16px', padding: '12px' }}
              >
                {finalizing ? <><LoadingSpinner size="sm" /> Compiling PDF...</> : '✅ Finalize This Answer Sheet'}
              </button>
            )}
          </div>
        </div>

        {/* Right: Finalized sheets list */}
        <div style={{
          width: '280px', flexShrink: 0,
          borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          overflow: 'auto', padding: '24px 20px',
        }}>
          <h4 style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Finalized Sheets ({finalizedSheets.length})
          </h4>
          {finalizedSheets.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '13px' }}>No sheets finalized yet.</p>
          ) : (
            finalizedSheets.map(s => (
              <div key={s.id} style={{
                padding: '10px 12px', background: 'rgba(16,185,129,0.07)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '8px', marginBottom: '8px',
              }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#34d399' }}>
                  Roll #{s.roll_number}
                </p>
                <p style={{ fontSize: '12px', color: '#64748b' }}>Sheet ID: {s.id}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
