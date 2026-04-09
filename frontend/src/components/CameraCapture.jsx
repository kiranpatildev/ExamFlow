import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * CameraCapture — camera-only image acquisition.
 *
 * Supports two modes:
 *   'camera' — live webcam via getUserMedia (built-in / USB cam)
 *   'ip'     — MJPEG stream from IP Webcam app
 *
 * Props:
 *   onCapture(blob, filename) — called for every captured frame
 *   disabled                 — disables all controls
 */
export default function CameraCapture({ onCapture, disabled = false }) {
  const [mode, setMode] = useState('camera');

  // ── Camera (getUserMedia) ────────────────────────────────────────────────
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flashActive, setFlashActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // ── IP Webcam ────────────────────────────────────────────────────────────
  const [ipUrl, setIpUrl] = useState('');
  const [ipConnected, setIpConnected] = useState(false);
  const [ipError, setIpError] = useState('');
  const ipImgRef = useRef(null);
  const ipCanvasRef = useRef(null);

  // ── Enumerate video devices ──────────────────────────────────────────────
  const enumerateDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const vids = all.filter((d) => d.kind === 'videoinput');
      setDevices(vids);
      if (vids.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(vids[0].deviceId);
      }
    } catch {
      // Permissions not yet granted — labels invisible until stream starts
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    enumerateDevices();
    navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', enumerateDevices);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Camera helpers ───────────────────────────────────────────────────────
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async (deviceId) => {
    stopCamera();
    setCameraError('');
    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      await enumerateDevices(); // labels become visible after permission
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Allow camera access in browser settings then retry.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found. Connect a USB cam or use IP Webcam mode.');
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  };

  const handleDeviceChange = async (id) => {
    setSelectedDeviceId(id);
    if (cameraActive) await startCamera(id);
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraActive) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 180);
    canvas.toBlob(
      (blob) => onCapture(blob, `capture_${Date.now()}.jpg`),
      'image/jpeg',
      0.95,
    );
  };

  // ── IP Webcam helpers ────────────────────────────────────────────────────
  const buildStreamUrl = (raw) => {
    const base = raw.trim().replace(/\/$/, '');
    if (base.includes('/shot') || base.includes('/video') || base.includes('.mjpg')) return base;
    return `${base}/video`;
  };

  const captureFromIp = () => {
    const img = ipImgRef.current;
    const canvas = ipCanvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 180);
    canvas.toBlob(
      (blob) => onCapture(blob, `ip_capture_${Date.now()}.jpg`),
      'image/jpeg',
      0.95,
    );
  };

  // ── Mode switch ──────────────────────────────────────────────────────────
  const switchMode = (m) => {
    if (m !== 'camera') stopCamera();
    if (m !== 'ip') { setIpConnected(false); setIpError(''); }
    setMode(m);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Mode tabs — camera only, NO file upload */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { key: 'camera', label: '📷 Camera',    desc: 'Built-in / USB webcam' },
          { key: 'ip',     label: '📱 IP Webcam', desc: 'Phone on same Wi-Fi' },
        ].map((m) => (
          <button
            key={m.key}
            id={`mode-${m.key}`}
            className={`btn ${mode === m.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => switchMode(m.key)}
            disabled={disabled}
            style={{ flexDirection: 'column', padding: '10px 18px', gap: '2px', lineHeight: 1.3 }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.label}</span>
            <span style={{ fontSize: '11px', opacity: 0.7, fontWeight: 400 }}>{m.desc}</span>
          </button>
        ))}
      </div>

      {/* ── CAMERA MODE ─────────────────────────────────────────────────── */}
      {mode === 'camera' && (
        <div>
          {/* Device selector */}
          {devices.length > 1 && (
            <div style={{ marginBottom: '12px' }}>
              <label className="form-label" htmlFor="camera-device-select">Select Camera</label>
              <select
                id="camera-device-select"
                className="select"
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                disabled={disabled}
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error */}
          {cameraError && (
            <div className="alert alert-error" style={{ marginBottom: '12px' }}>{cameraError}</div>
          )}

          {/* Video preview */}
          <div style={{
            position: 'relative', background: '#000', borderRadius: '10px',
            overflow: 'hidden', marginBottom: '12px', aspectRatio: '4/3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }}
            />
            {flashActive && (
              <div style={{ position: 'absolute', inset: 0, background: 'white', opacity: 0.65, pointerEvents: 'none' }} />
            )}
            {!cameraActive && !cameraError && (
              <div style={{ color: '#9ca3af', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>📷</div>
                <p style={{ fontSize: '13px' }}>Click "Start Camera" below</p>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Controls */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!cameraActive ? (
              <button
                id="start-camera-btn"
                className="btn btn-primary"
                onClick={() => startCamera(selectedDeviceId)}
                disabled={disabled}
                style={{ flex: 1, padding: '12px' }}
              >
                ▶ Start Camera
              </button>
            ) : (
              <>
                <button
                  id="capture-btn"
                  className="btn btn-primary"
                  onClick={captureFromCamera}
                  disabled={disabled}
                  style={{ flex: 2, padding: '12px', fontSize: '15px' }}
                >
                  📸 Capture Page
                </button>
                <button
                  id="stop-camera-btn"
                  className="btn btn-secondary"
                  onClick={stopCamera}
                  disabled={disabled}
                >
                  ⏹ Stop
                </button>
              </>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '8px' }}>
            💡 USB cameras appear in the selector above automatically.
          </p>
        </div>
      )}

      {/* ── IP WEBCAM MODE ──────────────────────────────────────────────── */}
      {mode === 'ip' && (
        <div>
          {!ipConnected ? (
            <div>
              <div className="form-group">
                <label className="form-label" htmlFor="ip-url-input">IP Webcam URL</label>
                <input
                  id="ip-url-input"
                  className="input"
                  value={ipUrl}
                  onChange={(e) => setIpUrl(e.target.value)}
                  placeholder="http://192.168.1.100:8080"
                  disabled={disabled}
                />
              </div>
              {ipError && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{ipError}</div>}
              <button
                id="connect-ip-btn"
                className="btn btn-primary"
                onClick={() => { if (!ipUrl.trim()) { setIpError('Enter the IP Webcam URL.'); return; } setIpError(''); setIpConnected(true); }}
                disabled={disabled}
                style={{ width: '100%' }}
              >
                Connect to Camera
              </button>
              <div style={{ background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px', marginTop: '14px' }}>
                <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>📱 Setup</p>
                <ol style={{ paddingLeft: '16px', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 2 }}>
                  <li>Install <strong>IP Webcam</strong> on Android (Play Store)</li>
                  <li>Connect phone to the same Wi-Fi as this PC</li>
                  <li>Open app → tap <strong>"Start server"</strong></li>
                  <li>Enter the URL shown in the app above</li>
                </ol>
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                position: 'relative', background: '#000', borderRadius: '10px',
                overflow: 'hidden', marginBottom: '12px', minHeight: '200px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  ref={ipImgRef}
                  src={buildStreamUrl(ipUrl)}
                  alt="IP Webcam stream"
                  crossOrigin="anonymous"
                  style={{ width: '100%', display: 'block' }}
                  onError={() => { setIpError('Cannot connect. Check IP address and ensure IP Webcam is running.'); setIpConnected(false); }}
                />
                {flashActive && (
                  <div style={{ position: 'absolute', inset: 0, background: 'white', opacity: 0.65, pointerEvents: 'none' }} />
                )}
              </div>
              <canvas ref={ipCanvasRef} style={{ display: 'none' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  id="ip-capture-btn"
                  className="btn btn-primary"
                  onClick={captureFromIp}
                  disabled={disabled}
                  style={{ flex: 2, padding: '12px', fontSize: '15px' }}
                >
                  📸 Capture Page
                </button>
                <button
                  id="ip-disconnect-btn"
                  className="btn btn-secondary"
                  onClick={() => { setIpConnected(false); setIpError(''); }}
                  disabled={disabled}
                >
                  ✕ Disconnect
                </button>
              </div>
              <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f0fff4', border: '1px solid #c6f6d5', borderRadius: '6px' }}>
                <p style={{ fontSize: '12px', color: '#276749' }}>
                  ✅ Connected — <strong>{ipUrl}</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
