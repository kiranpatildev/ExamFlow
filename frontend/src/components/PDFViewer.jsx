import React, {
  Component, useState, useEffect, useCallback, useRef,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import LoadingSpinner from './LoadingSpinner';

/**
 * Worker is locally bundled — no CDN, works on offline/LAN networks.
 * To update: npm update react-pdf && copy node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
 */
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ─── PDF-level error boundary ─────────────────────────────────────────────────
// Catches pdfjs render crashes (sendWithStream, port errors, etc.) and renders
// a recoverable error UI instead of propagating to EvaluationErrorBoundary.
class PDFErrorBoundary extends Component {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown PDF error' };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#fef2f2', gap: '12px', padding: '32px',
      }}>
        <div style={{ fontSize: '36px' }}>⚠️</div>
        <h3 style={{ color: '#991b1b', margin: 0 }}>PDF render error</h3>
        <p style={{
          fontSize: '13px', color: '#dc2626',
          maxWidth: '340px', textAlign: 'center', lineHeight: 1.6,
        }}>
          {this.state.message}
        </p>
        <button
          style={{
            padding: '8px 20px', background: '#1a202c', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
          }}
          onClick={() => this.setState({ hasError: false, message: '' })}
        >
          Try again
        </button>
      </div>
    );
  }
}

// ─── PDFViewerInner ───────────────────────────────────────────────────────────
function PDFViewerInner({ url }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);           // zoom multiplier on top of fit-width
  const [currentPage, setCurrentPage] = useState(1); // tracked via IntersectionObserver
  const [jumpValue, setJumpValue] = useState('');    // controlled jump-to-page input
  const [loadError, setLoadError] = useState(null);
  const [docLoading, setDocLoading] = useState(true);

  // Container for scroll + ResizeObserver
  const scrollRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // Per-page DOM refs for IntersectionObserver
  const pageRefs = useRef({});   // { [pageNum]: DOMElement }
  const ioRef    = useRef(null); // IntersectionObserver instance

  // ── Track container width with ResizeObserver ──────────────────────────────
  useEffect(() => {
    if (!scrollRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      // 32px = 2 × 16px padding inside the scroll div
      setContainerWidth(Math.max(200, entry.contentRect.width - 32));
    });
    ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Track current page with IntersectionObserver ───────────────────────────
  useEffect(() => {
    if (!numPages || !scrollRef.current) return;

    ioRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost visible page is "current"
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const n = parseInt(visible[0].target.dataset.pageNum, 10);
          if (!isNaN(n)) setCurrentPage(n);
        }
      },
      {
        root: scrollRef.current,
        threshold: 0.1,  // trigger as soon as 10% of page is visible
      }
    );

    ioRef.current = observer;

    // Observe each page div
    Object.entries(pageRefs.current).forEach(([, el]) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [numPages, containerWidth]); // re-run when pages render

  // ── Keyboard zoom shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); setScale(s => Math.min(3, +(s + 0.2).toFixed(1))); }
      if (e.key === '-')                  { e.preventDefault(); setScale(s => Math.max(0.3, +(s - 0.2).toFixed(1))); }
      if (e.key === '0')                  { e.preventDefault(); setScale(1.0); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setDocLoading(false);
    setLoadError(null);
  }, []);

  const onDocumentLoadError = useCallback((err) => {
    console.error('PDFViewer load error:', err);
    setLoadError(err?.message || 'Failed to load PDF');
    setDocLoading(false);
  }, []);

  // Set page ref and observe it
  const setPageRef = useCallback((pageNum, el) => {
    pageRefs.current[pageNum] = el;
    if (ioRef.current && el) ioRef.current.observe(el);
  }, []);

  // Jump to a specific page
  const jumpToPage = useCallback((n) => {
    const pageNum = Math.max(1, Math.min(n, numPages || 1));
    const el = pageRefs.current[pageNum];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
    }
    setCurrentPage(pageNum);
  }, [numPages]);

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const n = parseInt(jumpValue, 10);
    if (!isNaN(n)) jumpToPage(n);
    setJumpValue('');
  };

  // Effective page rendering width
  const pageRenderWidth = Math.round(containerWidth * scale);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 14px', flexShrink: 0,
        background: 'var(--color-surface-2)',
        borderBottom: '1px solid var(--color-border)',
        flexWrap: 'wrap', rowGap: '6px',
      }}>

        {/* Page count / current page */}
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {numPages
            ? `Page ${currentPage} / ${numPages}`
            : docLoading ? 'Loading…' : '—'}
        </span>

        {/* Jump to page */}
        {numPages > 1 && (
          <form onSubmit={handleJumpSubmit} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              id="pdf-jump-page"
              type="number"
              min={1}
              max={numPages}
              value={jumpValue}
              onChange={e => setJumpValue(e.target.value)}
              placeholder="Go to…"
              style={{
                width: '66px', padding: '4px 8px', fontSize: '12px',
                border: '1px solid var(--color-border)', borderRadius: '5px',
                background: '#fff', color: 'var(--color-text)',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button type="submit" style={{ ...btnStyle, fontSize: '11px', width: 'auto', padding: '4px 8px' }}>
              Go
            </button>
          </form>
        )}

        {/* Zoom */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Zoom</span>
          <button
            id="pdf-zoom-out"
            title="Zoom out (Ctrl -)"
            onClick={() => setScale(s => Math.max(0.3, +(s - 0.2).toFixed(1)))}
            style={btnStyle}
          >−</button>
          <span style={{
            fontSize: '12px', color: 'var(--color-text)',
            minWidth: '44px', textAlign: 'center', fontWeight: 600,
          }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            id="pdf-zoom-in"
            title="Zoom in (Ctrl +)"
            onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
            style={btnStyle}
          >+</button>
          <button
            id="pdf-zoom-reset"
            title="Reset zoom (Ctrl 0)"
            onClick={() => setScale(1.0)}
            style={{ ...btnStyle, width: 'auto', padding: '0 8px', fontSize: '11px' }}
          >
            Fit
          </button>
        </div>
      </div>

      {/* ── Scrollable PDF area ── */}
      {/* This is the ONLY element that scrolls. All ancestors must have overflow: hidden */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          padding: '16px',
          background: '#e8ecf0',
          // smooth momentum scrolling on iOS
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {loadError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '20px',
            textAlign: 'center', marginBottom: '12px',
          }}>
            <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '6px' }}>
              ⚠️ Could not load PDF
            </div>
            <p style={{ fontSize: '13px', color: '#dc2626' }}>{loadError}</p>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <LoadingSpinner size="lg" text="Loading PDF..." />
            </div>
          }
          error={null}
        >
          {numPages && Array.from({ length: numPages }, (_, i) => {
            const pageNum = i + 1;
            return (
              <div
                key={pageNum}
                data-page-num={pageNum}
                ref={el => setPageRef(pageNum, el)}
                style={{
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <Page
                  pageNumber={pageNum}
                  width={pageRenderWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={
                    <div style={{
                      width: pageRenderWidth,
                      height: Math.round(pageRenderWidth * 1.414), // A4 ratio
                      background: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    }}>
                      <LoadingSpinner size="sm" text={`Page ${pageNum}`} />
                    </div>
                  }
                />
              </div>
            );
          })}
        </Document>

        {/* Bottom hint for multi-page */}
        {numPages > 1 && (
          <div style={{
            textAlign: 'center', padding: '16px 0 8px',
            fontSize: '12px', color: '#94a3b8',
          }}>
            ↑ {numPages} pages total • Use Ctrl+Scroll or zoom controls to resize
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────
export default function PDFViewer({ url }) {
  return (
    <PDFErrorBoundary>
      <PDFViewerInner url={url} />
    </PDFErrorBoundary>
  );
}

const btnStyle = {
  width: '26px',
  height: '26px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '5px',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '15px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s',
  fontFamily: 'inherit',
  flexShrink: 0,
};
