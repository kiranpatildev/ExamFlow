import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import LoadingSpinner from './LoadingSpinner';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer({ url }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((err) => {
    setError('Failed to load PDF. Please try again.');
    setLoading(false);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '13px', color: '#94a3b8' }}>
          {numPages ? `${numPages} page${numPages > 1 ? 's' : ''}` : 'Loading...'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Zoom:</span>
          <button
            id="pdf-zoom-out"
            onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
            style={btnStyle}
          >−</button>
          <span style={{ fontSize: '13px', color: '#94a3b8', minWidth: '44px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            id="pdf-zoom-in"
            onClick={() => setScale(s => Math.min(3, s + 0.2))}
            style={btnStyle}
          >+</button>
        </div>
      </div>

      {/* PDF content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', background: '#0f172a' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <LoadingSpinner size="lg" text="Loading PDF..." />
          </div>
        )}
        {error && (
          <div style={{ color: '#f87171', textAlign: 'center', padding: '40px' }}>{error}</div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          options={{ withCredentials: false }}
        >
          {numPages && Array.from({ length: numPages }, (_, i) => (
            <div key={i} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
              <Page
                pageNumber={i + 1}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}

const btnStyle = {
  width: '28px', height: '28px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: '16px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s',
};
