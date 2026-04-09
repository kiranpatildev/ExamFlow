import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * CameraCapture — unified image acquisition component.
 *
 * Supports three modes:
 *   'file'   — traditional file picker / drag-and-drop
 *   'camera' — live webcam via getUserMedia (built-in laptop cam or USB cam)
 *   'ip'     — MJPEG stream from an IP Webcam app (e.g. phone on same Wi-Fi)
 *
 * Props:
 *   onCapture(blob, filename) — called for every captured image
 *   disabled — disables all controls
 */
export default function CameraCapture({ onCapture, disabled = false }) {
  const [mode, setMode] = useState('file');

  // ── Camera (getUserMedia) state ──────────────────────────────────────────
  const [devices, setDevices] = useState([]);            // VideoInputDevice list
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flashActive, setFlashActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // ── IP Webcam state ──────────────────────────────────────────────────────
  const [ipUrl, setIpUrl] = useState('');
  const [ipConnected, setIpConnected] = useState(false);
  const [ipError, setIpError] = useState('');
  const ipImgRef = useRef(null);
  const ipCanvasRef = useRef(null);

  // ── File drop state ──────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Enumerate available video devices (after permission granted)
  // ─────────────────────────────────────────────────────────────────────────
  const enumerateDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = all.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch {
      // Permissions not yet granted — will retry after getUserMedia
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    enumerateDevices();
    // Listen for device changes (e.g. USB cam plugged in)
    navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', enumerateDevices);
  }, [enumerateDevices]);

  // Stop active stream when mode changes or component unmounts
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Camera helpers
  // ─────────────────────────────────────────────────────────────────────────
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async (deviceId) => {
    stopCamera();
    setCameraError('');
    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      // Enumerate now that permission is granted (labels become visible)
      await enumerateDevices();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a USB camera or built-in webcam.');
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  };

  const handleDeviceChange = async (deviceId) => {
    setSelectedDeviceId(deviceId);
    if (cameraActive) await startCamera(deviceId);
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    // Flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    canvas.toBlob(blob => {
      const filename = `capture_${Date.now()}.jpg`;
      onCapture(blob, filename);
    }, 'image/jpeg', 0.95);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // IP Webcam helpers
  // ─────────────────────────────────────────────────────────────────────────
  // Normalise URL: strip trailing slash, append /video for MJPEG stream
  const buildStreamUrl = (raw) => {
    const base = raw.trim().replace(/\/$/, '');
    // If user already typed a path like /shot.jpg or /video, use as-is
    if (base.includes('/shot') || base.includes('/video') || base.includes('.mjpg')) return base;
    return `${base}/video`; // IP Webcam app default MJPEG endpoint
  };

  const connectToIp = () => {
    if (!ipUrl.trim()) { setIpError('Please enter the IP Webcam URL.'); return; }
    setIpError('');
    setIpConnected(true);
  };

  const captureFromIp = () => {
    const img = ipImgRef.current;
    const canvas = ipCanvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);

    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    canvas.toBlob(blob => {
      const filename = `ip_capture_${Date.now()}.jpg`;
      onCapture(blob, filename);
    }, 'image/jpeg', 0.95);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // File helpers
  // ─────────────────────────────────────────────────────────────────────────
  const handleFiles = (fileList) => {
    Array.from(fileList).forEach(file => {
      onCapture(file, file.name);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handle switching modes
  // ─────────────────────────────────────────────────────────────────────────
  const switchMode = (m) => {
    if (m !== 'camera') stopCamera();
    if (m !== 'ip') { setIpConnected(false); setIpError(''); }
    setMode(m);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const modeButtons = [
    { key: 'file',   label: '📁 File Upload',   desc: 'Select from disk' },
    { key: 'camera', label: '📷 Camera',         desc: 'Laptop or USB webcam' },
    { key: 'ip',     label: '📱 IP Webcam',      desc: 'Phone / network camera' },
  ];

  return (
    <div>
      {/* Mode selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {modeButtons.map(m => (
          <button
            key={m.key}
            id={`mode-${m.key}`}
            className={`btn ${mode === m.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => switchMode(m.key)}
            disabled={disabled}
            style={{ flexDirection: 'column', padding: '10px 16px', gap: '2px', lineHeight: 1.3 }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.label}</span>
            <span style={{ fontSize: '11px', opacity: 0.7, fontWeight: 400 }}>{m.desc}</span>
          </button>
        ))}
      </div>

      {/* ── FILE MODE ─────────────────────────────────────────────────────── */}
      {mode === 'file' && (
        <div
          id="file-drop-zone"
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => !disabled && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📁</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
            Click or drag images here
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            JPEG or PNG — multiple pages supported
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
            disabled={disabled}
          />
        </div>
      )}

      {/* ── CAMERA MODE ───────────────────────────────────────────────────── */}
      {mode === 'camera' && (
        <div>
          {/* Device selector */}
          {devices.length > 1 && (
            <div style={{ marginBottom: '12px' }}>
              <label className="form-label">Select Camera</label>
              <select
                id="camera-select"
                className="select"
                value={selectedDeviceId}
                onChange={e => handleDeviceChange(e.target.value)}
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

          {/* Camera error */}
          {cameraError && (
            <div className="alert alert-error" style={{ marginBottom: '12px' }}>{cameraError}</div>
          )}

          {/* Video preview */}
          <div style={{
            position: 'relative',
            background: '#000',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '12px',
            aspectRatio: '16/9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', display: cameraActive ? 'block' : 'none' }}
            />
            {/* Flash overlay */}
            {flashActive && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'white', opacity: 0.7,
                pointerEvents: 'none',
              }} />
            )}
            {!cameraActive && !cameraError && (
              <div style={{ color: '#9ca3af', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>📷</div>
                <p>Camera preview will appear here</p>
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
                style={{ flex: 1 }}
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
                  style={{ flex: 2, padding: '12px' }}
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
            💡 USB cameras appear in the selector above automatically. Capture once per page.
          </p>
        </div>
      )}

      {/* ── IP WEBCAM MODE ────────────────────────────────────────────────── */}
      {mode === 'ip' && (
        <div>
          {/* Connection form */}
          {!ipConnected ? (
            <div>
              <div className="form-group">
                <label className="form-label">IP Webcam URL</label>
                <input
                  id="ip-url-input"
                  className="input"
                  value={ipUrl}
                  onChange={e => setIpUrl(e.target.value)}
                  placeholder="http://192.168.1.100:8080"
                  disabled={disabled}
                />
                <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '5px', lineHeight: 1.6 }}>
                  On your phone, open <strong>IP Webcam</strong> (Android) or <strong>DroidCam</strong> and
                  enter the URL shown in the app. Both devices must be on the same Wi-Fi network.
                </p>
              </div>

              {ipError && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{ipError}</div>}

              <button
                id="connect-ip-btn"
                className="btn btn-primary"
                onClick={connectToIp}
                disabled={disabled}
                style={{ width: '100%' }}
              >
                Connect to Camera
              </button>

              {/* Setup guide */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '14px',
                marginTop: '16px',
              }}>
                <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                  📱 Quick Setup Guide
                </p>
                <ol style={{ paddingLeft: '16px', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 2 }}>
                  <li>Install <strong>IP Webcam</strong> app on Android (free on Play Store)</li>
                  <li>Connect phone to the same Wi-Fi as this computer</li>
                  <li>Open app → scroll down → tap <strong>"Start server"</strong></li>
                  <li>Note the URL shown (e.g. <code>http://192.168.1.5:8080</code>)</li>
                  <li>Enter that URL above and click Connect</li>
                </ol>
                <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '8px' }}>
                  Also works with: DroidCam, iVCam, EpocCam, any MJPEG-compatible IP camera.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Live stream preview */}
              <div style={{
                position: 'relative',
                background: '#000',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '12px',
                minHeight: '200px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  ref={ipImgRef}
                  src={buildStreamUrl(ipUrl)}
                  alt="IP Webcam stream"
                  crossOrigin="anonymous"
                  style={{ width: '100%', display: 'block' }}
                  onError={() => {
                    setIpError('Could not connect to that URL. Check the IP address and ensure IP Webcam is running.');
                    setIpConnected(false);
                  }}
                />
                {/* Flash overlay */}
                {flashActive && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'white', opacity: 0.7,
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
              <canvas ref={ipCanvasRef} style={{ display: 'none' }} />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  id="ip-capture-btn"
                  className="btn btn-primary"
                  onClick={captureFromIp}
                  disabled={disabled}
                  style={{ flex: 2, padding: '12px' }}
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
                  ✅ Connected to: <strong>{ipUrl}</strong>
                  <br />Click "Capture Page" for each page of the answer sheet.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
