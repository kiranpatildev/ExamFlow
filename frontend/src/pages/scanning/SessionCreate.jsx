import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { createBundle } from '../../api/bundles';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────── */
const QR_ELEMENT_ID = 'qr-reader-viewport';

const SCANNER_CONFIG = {
  fps: 15,
  qrbox: { width: 260, height: 260 },
  aspectRatio: 1.0,
  disableFlip: false,
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
};

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
function parseQrPayload(rawText) {
  try {
    const data = JSON.parse(rawText);
    const missing = ['subject_code', 'bundle_number', 'total_sheets'].filter(
      (k) => !(k in data),
    );
    if (missing.length) {
      return { error: `QR is missing required fields: ${missing.join(', ')}` };
    }
    if (!Number.isInteger(data.total_sheets) || data.total_sheets <= 0) {
      return { error: 'total_sheets must be a positive integer in the QR.' };
    }
    return { data };
  } catch {
    return { error: 'QR code does not contain valid JSON. Please scan the correct bundle cover.' };
  }
}

/* ─────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────── */
function ConfirmRow({ label, value, accent = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid var(--color-border-2)',
    }}>
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{
        fontSize: '14px', fontWeight: 700,
        color: accent ? 'var(--color-indigo)' : 'var(--color-text)',
        background: accent ? 'var(--color-indigo-bg)' : 'transparent',
        padding: accent ? '2px 10px' : '0',
        borderRadius: accent ? '999px' : '0',
      }}>
        {value}
      </span>
    </div>
  );
}

function ScannerView({ onSuccess, onClose }) {
  const scannerRef = useRef(null);
  const mountedRef = useRef(true);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [scanning, setScanning] = useState(false);

  /* Enumerate cameras once on mount */
  useEffect(() => {
    mountedRef.current = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!mountedRef.current) return;
        if (!devices || devices.length === 0) {
          setScannerError('No camera found. Please allow camera access or use the manual entry below.');
          return;
        }
        setCameras(devices);
        // Prefer a rear-facing camera (environment) for phones
        const rear = devices.find(
          (d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment'),
        );
        setSelectedCamera(rear?.id || devices[0].id);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        console.error('Camera enumeration error:', err);
        setScannerError(
          'Camera access denied. Please allow camera permissions in your browser, then refresh.',
        );
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* Start / restart scanner whenever selectedCamera changes */
  useEffect(() => {
    if (!selectedCamera) return;

    let instance = null;

    const startScanner = async () => {
      // Stop any previous instance
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch {}
        try { scannerRef.current.clear(); } catch {}
        scannerRef.current = null;
      }

      if (!mountedRef.current) return;

      try {
        instance = new Html5Qrcode(QR_ELEMENT_ID);
        scannerRef.current = instance;
        setScanning(true);

        await instance.start(
          selectedCamera,
          SCANNER_CONFIG,
          (decodedText) => {
            // Pause scanner to avoid repeated scans
            instance.pause(true);
            onSuccess(decodedText);
          },
          () => {}, // silent frame errors
        );
      } catch (err) {
        if (!mountedRef.current) return;
        console.error('Scanner start error:', err);
        setScannerError(
          'Could not start camera. Try selecting a different camera or reload the page.',
        );
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera]);

  if (scannerError) {
    return (
      <div className="alert alert-error" style={{ marginTop: '12px' }}>
        <span>⚠️</span>
        <span>{scannerError}</span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Camera selector */}
      {cameras.length > 1 && (
        <div style={{ marginBottom: '10px' }}>
          <label className="form-label" htmlFor="camera-select">Select Camera</label>
          <select
            id="camera-select"
            className="select"
            value={selectedCamera || ''}
            onChange={(e) => setSelectedCamera(e.target.value)}
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>{c.label || `Camera ${c.id}`}</option>
            ))}
          </select>
        </div>
      )}

      {/* Viewport */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
        <div
          id={QR_ELEMENT_ID}
          style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}
        />
        {!scanning && (
          <div style={{
            position: 'absolute', inset: 0, background: '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '12px',
          }}>
            <LoadingSpinner size="lg" text="Starting camera…" />
          </div>
        )}
        {/* Corner-overlay guides */}
        {scanning && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '200px', height: '200px', position: 'relative',
            }}>
              {[
                { top: 0, left: 0, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '4px 0 0 0' },
                { top: 0, right: 0, borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 4px 0 0' },
                { bottom: 0, left: 0, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '0 0 0 4px' },
                { bottom: 0, right: 0, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 0 4px 0' },
              ].map((style, i) => (
                <div key={i} style={{ position: 'absolute', width: '28px', height: '28px', ...style }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <p style={{
        textAlign: 'center', fontSize: '12px',
        color: 'var(--color-text-muted)', marginTop: '10px',
      }}>
        📷 Point at the QR code on the bundle cover
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Page Component
───────────────────────────────────────────────────────── */
export default function SessionCreate() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  // UI state machine: 'scan' | 'confirm' | 'creating'
  const [phase, setPhase] = useState('scan');
  const [showScanner, setShowScanner] = useState(false);
  const [parsedQr, setParsedQr] = useState(null);   // { data, rawText }
  const [creating, setCreating] = useState(false);
  const [qrError, setQrError] = useState('');
  const [showManual, setShowManual] = useState(false);

  // Manual-entry fallback fields
  const [manualJson, setManualJson] = useState('');
  const [manualError, setManualError] = useState('');

  /* ── QR scan success callback ── */
  const handleQrSuccess = useCallback((rawText) => {
    const { data, error } = parseQrPayload(rawText);
    if (error) {
      setQrError(error);
      setShowScanner(false);
      return;
    }
    setQrError('');
    setParsedQr({ data, rawText });
    setShowScanner(false);
    setPhase('confirm');
  }, []);

  /* ── Rescan ── */
  const handleRescan = () => {
    setParsedQr(null);
    setQrError('');
    setPhase('scan');
    setShowScanner(false);
  };

  /* ── Manual entry submit ── */
  const handleManualSubmit = () => {
    setManualError('');
    const { data, error } = parseQrPayload(manualJson.trim());
    if (error) {
      setManualError(error);
      return;
    }
    setParsedQr({ data, rawText: manualJson.trim() });
    setShowManual(false);
    setManualJson('');
    setPhase('confirm');
  };

  /* ── Create Bundle ── */
  const handleCreate = async () => {
    if (!parsedQr) return;
    setCreating(true);
    try {
      const res = await createBundle(parsedQr.rawText);
      toast.success(`Bundle #${parsedQr.data.bundle_number} created!`);
      navigate(`/scanning/upload/${res.data.id}`);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.qr_raw_data?.[0] ||
        'Failed to create bundle. Please try again.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  /* ─── Render ─── */
  return (
    <div className="main-layout">
      <AppSidebar role="scanning_staff" userName={auth?.fullName || 'Staff'} logout={logout} />

      <div className="main-content">
        <div className="content-body" style={{ maxWidth: '700px' }}>

          {/* ── Page header ── */}
          <div className="page-header">
            <div className="page-header-left">
              <h1>New Bundle</h1>
              <p>Scan the QR code on the bundle cover to create a new answer-sheet bundle.</p>
            </div>
          </div>

          {/* ── Progress steps ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
            gap: '12px', marginBottom: '28px',
          }}>
            {[
              { n: '1', icon: '🔲', title: 'Scan QR', desc: 'Point camera at bundle cover QR', active: phase === 'scan' },
              { n: '2', icon: '✅', title: 'Confirm', desc: 'Verify bundle details', active: phase === 'confirm' },
              { n: '3', icon: '📷', title: 'Scan Sheets', desc: 'Upload each answer sheet', active: false },
            ].map((s) => (
              <div key={s.n} className="card" style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                padding: '16px',
                borderColor: s.active ? 'var(--color-indigo)' : 'var(--color-border)',
                boxShadow: s.active ? '0 0 0 2px rgba(90,103,216,0.15)' : 'var(--shadow-sm)',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: s.active ? 'var(--color-indigo)' : '#1a202c',
                  color: '#fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0,
                }}>{s.n}</div>
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '2px', fontSize: '13px' }}>{s.icon} {s.title}</p>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ═══════════════════════════════════════
              PHASE: SCAN
          ═══════════════════════════════════════ */}
          {phase === 'scan' && (
            <div className="card fade-in-up">
              <h3 style={{ marginBottom: '6px' }}>🔲 Scan Bundle QR Code</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                Open the camera and point it at the printed QR code on the front of the bundle cover.
              </p>

              {/* QR error from previous scan */}
              {qrError && (
                <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                  <span>⚠️</span>
                  <div>
                    <strong>Invalid QR Code</strong>
                    <p style={{ marginTop: '2px', fontSize: '12px' }}>{qrError}</p>
                  </div>
                </div>
              )}

              {/* Camera scanner */}
              {!showScanner ? (
                <button
                  id="open-camera-btn"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '15px', gap: '10px' }}
                  onClick={() => { setQrError(''); setShowScanner(true); }}
                >
                  <span style={{ fontSize: '20px' }}>📷</span>
                  Open Camera & Scan QR
                </button>
              ) : (
                <div>
                  <ScannerView
                    onSuccess={handleQrSuccess}
                    onClose={() => setShowScanner(false)}
                  />
                  <button
                    id="close-camera-btn"
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={() => setShowScanner(false)}
                  >
                    ✕ Close Camera
                  </button>
                </div>
              )}

              {/* Manual fallback */}
              <div style={{ marginTop: '24px' }}>
                <button
                  id="toggle-manual-btn"
                  className="btn btn-ghost"
                  style={{ width: '100%', fontSize: '13px', color: 'var(--color-text-muted)' }}
                  onClick={() => setShowManual((v) => !v)}
                >
                  {showManual ? '▲ Hide manual entry' : '▼ Can\'t scan? Enter QR data manually'}
                </button>

                {showManual && (
                  <div style={{
                    marginTop: '12px', padding: '16px',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                  }}
                    className="fade-in-up"
                  >
                    <label className="form-label" htmlFor="manual-json">
                      Paste QR JSON Data
                    </label>
                    <textarea
                      id="manual-json"
                      className={`input textarea ${manualError ? 'error' : ''}`}
                      style={{ fontFamily: 'monospace', fontSize: '12px', minHeight: '100px', resize: 'vertical' }}
                      value={manualJson}
                      onChange={(e) => { setManualJson(e.target.value); setManualError(''); }}
                      placeholder={'{\n  "subject_name": "Microcontroller",\n  "subject_code": "MC501",\n  "bundle_number": 3,\n  "total_sheets": 25\n}'}
                      spellCheck={false}
                    />
                    {manualError && (
                      <p className="error-text" style={{ marginBottom: '8px' }}>⚠️ {manualError}</p>
                    )}
                    <button
                      id="manual-submit-btn"
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '8px' }}
                      onClick={handleManualSubmit}
                    >
                      Use This Data →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              PHASE: CONFIRM
          ═══════════════════════════════════════ */}
          {phase === 'confirm' && parsedQr && (
            <div className="card fade-in-up">
              {/* Success banner */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 18px',
                background: 'var(--color-success-bg)',
                border: '1px solid var(--color-success-b)',
                borderRadius: '10px',
                marginBottom: '24px',
              }}>
                <span style={{ fontSize: '24px' }}>✅</span>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--color-success)', fontSize: '14px' }}>
                    QR Code Scanned Successfully
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-success)', opacity: 0.8 }}>
                    Verify the details below before creating the bundle.
                  </p>
                </div>
              </div>

              {/* Confirmation fields */}
              <h3 style={{ marginBottom: '16px' }}>📋 Bundle Details</h3>
              <div style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '0 16px',
                marginBottom: '24px',
              }}>
                {parsedQr.data.subject_name && (
                  <ConfirmRow label="Subject Name" value={parsedQr.data.subject_name} />
                )}
                <ConfirmRow label="Subject Code" value={parsedQr.data.subject_code} accent />
                <ConfirmRow label="Bundle Number" value={`#${parsedQr.data.bundle_number}`} />
                <ConfirmRow
                  label="Total Answer Sheets"
                  value={`${parsedQr.data.total_sheets} sheets`}
                />
              </div>

              {/* Raw QR toggle for transparency */}
              <details style={{ marginBottom: '20px' }}>
                <summary style={{
                  fontSize: '12px', color: 'var(--color-text-muted)',
                  cursor: 'pointer', userSelect: 'none',
                }}>
                  View raw QR data
                </summary>
                <pre style={{
                  marginTop: '8px', padding: '10px 14px',
                  background: '#1a202c', color: '#e2e8f0',
                  borderRadius: '8px', fontSize: '11px',
                  fontFamily: 'monospace', overflowX: 'auto',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {JSON.stringify(parsedQr.data, null, 2)}
                </pre>
              </details>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  id="rescan-btn"
                  className="btn btn-secondary"
                  style={{ flex: '0 0 auto' }}
                  onClick={handleRescan}
                  disabled={creating}
                >
                  ↩ Re-scan
                </button>
                <button
                  id="create-bundle-btn"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px', fontSize: '15px' }}
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating
                    ? <><LoadingSpinner size="sm" /> Creating Bundle…</>
                    : '🚀 Create Bundle & Start Scanning'}
                </button>
              </div>
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
