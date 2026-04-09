import React, {
  Component, useState, useEffect, useCallback, useRef,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import LoadingSpinner from './LoadingSpinner';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ─── Error boundary ───────────────────────────────────────────────────────────
class PDFErrorBoundary extends Component {
  state = { hasError: false, message: '' };
  static getDerivedStateFromError(e) { return { hasError: true, message: e?.message || 'PDF error' }; }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', gap: '12px', padding: '32px' }}>
        <div style={{ fontSize: '36px' }}>⚠️</div>
        <h3 style={{ color: '#991b1b', margin: 0 }}>PDF render error</h3>
        <p style={{ fontSize: '13px', color: '#dc2626', maxWidth: '340px', textAlign: 'center', lineHeight: 1.6 }}>{this.state.message}</p>
        <button style={{ padding: '8px 20px', background: '#1a202c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }} onClick={() => this.setState({ hasError: false })}>Try again</button>
      </div>
    );
  }
}

// ─── Helper: clamp a value ───────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 96) => Math.max(lo, Math.min(hi, v));

// ─── MarkLabel ────────────────────────────────────────────────────────────────
/**
 * A single draggable mark label.
 * - Positioned with absolute PIXEL coordinates inside the global scroll layer.
 * - On drag-end, we find which page canvas the label was dropped on and
 *   convert back to page-relative percentages before calling onDragEnd.
 * - Touch events are supported.
 * - Has a ✕ button to clear the label from the overlay.
 */
function MarkLabel({ questionKey, value, absLeft, absTop, canvasRefs, scrollRef, numPages, onDragEnd, onClearMark, readOnly }) {
  const labelRef  = useRef(null);
  const dragState = useRef(null);

  const handlePointerDown = useCallback((e) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = {
      startClientX: clientX, startClientY: clientY,
      startAbsLeft: absLeft, startAbsTop: absTop,
      _liveLeft: absLeft,   _liveTop: absTop,
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup',   handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend',  handlePointerUp);
  }, [absLeft, absTop, readOnly]);

  const handlePointerMove = useCallback((e) => {
    if (!dragState.current) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragState.current.startClientX;
    const dy = clientY - dragState.current.startClientY;
    const nx = dragState.current.startAbsLeft + dx;
    const ny = dragState.current.startAbsTop  + dy;

    if (labelRef.current) {
      labelRef.current.style.left = `${nx}px`;
      labelRef.current.style.top  = `${ny}px`;
    }
    dragState.current._liveLeft = nx;
    dragState.current._liveTop  = ny;
  }, []);

  const handlePointerUp = useCallback(() => {
    window.removeEventListener('mousemove', handlePointerMove);
    window.removeEventListener('mouseup',   handlePointerUp);
    window.removeEventListener('touchmove', handlePointerMove);
    window.removeEventListener('touchend',  handlePointerUp);

    if (!dragState.current) return;
    const finalL = dragState.current._liveLeft;
    const finalT = dragState.current._liveTop;
    dragState.current = null;

    if (!scrollRef.current) return;
    const scrollEl = scrollRef.current;
    const sr = scrollEl.getBoundingClientRect();

    // Find which page canvas the drop point falls within
    for (let p = 1; p <= numPages; p++) {
      const canvasEl = canvasRefs.current[p];
      if (!canvasEl) continue;
      const cr = canvasEl.getBoundingClientRect();
      const pageL = cr.left - sr.left + scrollEl.scrollLeft;
      const pageT = cr.top  - sr.top  + scrollEl.scrollTop;
      const pageW = cr.width;
      const pageH = cr.height;

      if (finalL >= pageL && finalL <= pageL + pageW &&
          finalT >= pageT && finalT <= pageT + pageH) {
        const newX = clamp(((finalL - pageL) / pageW) * 100);
        const newY = clamp(((finalT - pageT) / pageH) * 100);
        onDragEnd(questionKey, newX, newY, p);
        return;
      }
    }
    // Dropped between pages — keep original position (no update)
  }, [questionKey, numPages, onDragEnd, canvasRefs, scrollRef, handlePointerMove]);

  const num = parseFloat(value);
  if (isNaN(num)) return null;
  const display = Number.isInteger(num) ? num : num;

  return (
    <div
      ref={labelRef}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      title={readOnly ? questionKey : `${questionKey} — drag to any page`}
      style={{
        position: 'absolute',
        left: `${absLeft}px`,
        top:  `${absTop}px`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        cursor: readOnly ? 'default' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        zIndex: 20,
        background: 'rgba(255,255,255,0.93)',
        border: '2px solid #dc2626',
        borderRadius: '6px',
        padding: '2px 6px 2px 7px',
        fontSize: '15px',
        fontWeight: 700,
        color: '#dc2626',
        lineHeight: '1.4',
        boxShadow: '0 2px 8px rgba(220,38,38,0.28)',
        minWidth: '28px',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
      }}
    >
      {display}
      {!readOnly && (
        <span
          onMouseDown={e => { e.stopPropagation(); onClearMark?.(questionKey); }}
          onTouchStart={e => { e.stopPropagation(); onClearMark?.(questionKey); }}
          style={{
            fontSize: '10px', lineHeight: 1,
            cursor: 'pointer', opacity: 0.55,
            padding: '1px 2px',
            borderRadius: '3px',
          }}
          title="Remove from overlay"
        >
          ✕
        </span>
      )}
    </div>
  );
}

// ─── GlobalMarkLayer ──────────────────────────────────────────────────────────
/**
 * Renders ALL mark labels as a single absolute layer inside the scroll container.
 * Labels live in scroll-content space — they scroll naturally with pages.
 *
 * Architecture: This is the KEY change that allows cross-page dragging.
 * Instead of per-page overlays (which trap labels inside their page div),
 * one layer covers everything and labels can be dragged to any page.
 */
function GlobalMarkLayer({ markPositions, canvasRefs, scrollRef, numPages, onDragEnd, onClearMark, readOnly, tick }) {
  const getCanvasAbsRect = (pageNum) => {
    const canvasEl = canvasRefs.current[pageNum];
    const scrollEl = scrollRef.current;
    if (!canvasEl || !scrollEl) return null;
    const cr = canvasEl.getBoundingClientRect();
    const sr = scrollEl.getBoundingClientRect();
    return {
      left:   cr.left - sr.left + scrollEl.scrollLeft,
      top:    cr.top  - sr.top  + scrollEl.scrollTop,
      width:  cr.width,
      height: cr.height,
    };
  };

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0,
        // width/height:100% covers viewport, not full content.
        // We use pointerEvents:none on this wrapper + auto on children.
        // Labels are absolutely positioned in scroll-space so they scroll naturally.
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',  // Let labels extend beyond this layer's visible bounds
      }}
    >
      {Object.entries(markPositions).map(([key, entry]) => {
        if (entry.value === '' || entry.value === null || entry.value === undefined) return null;
        if (isNaN(parseFloat(entry.value))) return null;

        const pageNum = entry.page ?? 1;
        const rect = getCanvasAbsRect(pageNum);
        if (!rect) return null;

        const absLeft = rect.left + (entry.x / 100) * rect.width;
        const absTop  = rect.top  + (entry.y / 100) * rect.height;

        return (
          <MarkLabel
            key={key}
            questionKey={key}
            value={entry.value}
            absLeft={absLeft}
            absTop={absTop}
            canvasRefs={canvasRefs}
            scrollRef={scrollRef}
            numPages={numPages}
            onDragEnd={onDragEnd}
            onClearMark={onClearMark}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

// ─── PDFViewerInner ───────────────────────────────────────────────────────────
function PDFViewerInner({ url, markPositions = {}, onPageChange, onDragEnd, onClearMark, readOnly = false }) {
  const [numPages, setNumPages]       = useState(null);
  const [scale, setScale]             = useState(1.0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpValue, setJumpValue]     = useState('');
  const [loadError, setLoadError]     = useState(null);
  const [docLoading, setDocLoading]   = useState(true);

  // Tick counter forces GlobalMarkLayer to recompute canvas positions
  // after PDF pages render or zoom changes.
  const [tick, setTick]               = useState(0);

  const scrollRef   = useRef(null);
  const pageRefs    = useRef({});   // outer wrappers (for scroll position calc)
  const canvasRefs  = useRef({});   // inner inline-block wrappers (exact canvas size)

  const [containerWidth, setContainerWidth] = useState(600);

  // ── Container width ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      setContainerWidth(Math.max(200, e.contentRect.width - 32));
    });
    ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Page detection via scroll events (no IntersectionObserver) ───────────────
  //    IntersectionObserver with threshold=0.1 can skip pages when scrolling fast.
  //    Instead: on every scroll event, find which page's center is closest to the
  //    viewport center. This is always exact and never skips.
  const currentPageRef = useRef(1);

  const handleScroll = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const viewportCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2;

    let bestPage = currentPageRef.current;
    let bestDist = Infinity;
    Object.entries(pageRefs.current).forEach(([num, el]) => {
      if (!el) return;
      const pageCenter = el.offsetTop + el.offsetHeight / 2;
      const dist = Math.abs(viewportCenter - pageCenter);
      if (dist < bestDist) { bestDist = dist; bestPage = parseInt(num); }
    });

    if (bestPage !== currentPageRef.current) {
      currentPageRef.current = bestPage;
      setCurrentPage(bestPage);
      onPageChange?.(bestPage);
    }
  }, [onPageChange]);

  // ── Keyboard zoom ────────────────────────────────────────────────────────────
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

  // Bump tick after each zoom/resize so GlobalMarkLayer recomputes canvas positions
  useEffect(() => { setTick(t => t + 1); }, [scale, containerWidth]);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setDocLoading(false);
    setLoadError(null);
    // Delay: give react-pdf time to render canvases before we compute positions
    setTimeout(() => setTick(t => t + 1), 400);
  }, []);

  const onDocumentLoadError = useCallback((err) => {
    setLoadError(err?.message || 'Failed to load PDF');
    setDocLoading(false);
  }, []);

  const onPageRenderSuccess = useCallback(() => {
    // Each page render: bump tick so GlobalMarkLayer repositions labels
    setTick(t => t + 1);
  }, []);

  const jumpToPage = useCallback((n) => {
    const p = Math.max(1, Math.min(n, numPages || 1));
    const el = pageRefs.current[p];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
    }
    currentPageRef.current = p;
    setCurrentPage(p);
    onPageChange?.(p);
  }, [numPages, onPageChange]);

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const n = parseInt(jumpValue, 10);
    if (!isNaN(n)) jumpToPage(n);
    setJumpValue('');
  };

  const pageRenderWidth = Math.round(containerWidth * scale);

  const marksOnCurrentPage = Object.values(markPositions).filter(
    e => (e.page ?? 1) === currentPage && e.value !== '' && e.value != null && !isNaN(parseFloat(e.value))
  ).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', flexShrink: 0, background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', rowGap: '6px' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {numPages ? `Page ${currentPage} / ${numPages}` : docLoading ? 'Loading…' : '—'}
        </span>

        {numPages > 1 && (
          <form onSubmit={handleJumpSubmit} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              id="pdf-jump-page" type="number" min={1} max={numPages}
              value={jumpValue} onChange={e => setJumpValue(e.target.value)} placeholder="Go to…"
              style={{ width: '66px', padding: '4px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '5px', background: '#fff', color: 'var(--color-text)', outline: 'none', fontFamily: 'inherit' }}
            />
            <button type="submit" style={{ ...btnStyle, fontSize: '11px', width: 'auto', padding: '4px 8px' }}>Go</button>
          </form>
        )}

        {!readOnly && marksOnCurrentPage > 0 && (
          <span style={{ fontSize: '11px', color: '#dc2626', background: '#fff5f5', padding: '2px 8px', borderRadius: '999px', border: '1px solid #fecaca' }}>
            {marksOnCurrentPage} mark{marksOnCurrentPage !== 1 ? 's' : ''} • drag across pages • ✕ to clear
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Zoom</span>
          <button id="pdf-zoom-out"   title="Zoom out (Ctrl -)" onClick={() => setScale(s => Math.max(0.3, +(s - 0.2).toFixed(1)))} style={btnStyle}>−</button>
          <span style={{ fontSize: '12px', minWidth: '44px', textAlign: 'center', fontWeight: 600 }}>{Math.round(scale * 100)}%</span>
          <button id="pdf-zoom-in"    title="Zoom in (Ctrl +)"  onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))} style={btnStyle}>+</button>
          <button id="pdf-zoom-reset" title="Reset zoom (Ctrl 0)" onClick={() => setScale(1.0)} style={{ ...btnStyle, width: 'auto', padding: '0 8px', fontSize: '11px' }}>Fit</button>
        </div>
      </div>

      {/* ── Scrollable PDF area ── */}
      {/*
        position:relative is REQUIRED here.
        GlobalMarkLayer is position:absolute inside this div.
        Labels in scroll-content-space naturally scroll with the pages.
      */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto', overflowX: 'auto',
          padding: '16px',
          background: '#e8ecf0',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',   // anchor for GlobalMarkLayer
        }}
      >
        {loadError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '20px', textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '6px' }}>⚠️ Could not load PDF</div>
            <p style={{ fontSize: '13px', color: '#dc2626' }}>{loadError}</p>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><LoadingSpinner size="lg" text="Loading PDF..." /></div>}
          error={null}
        >
          {numPages && Array.from({ length: numPages }, (_, i) => {
            const pageNum = i + 1;
            return (
              <div
                key={pageNum}
                data-page-num={pageNum}
                ref={el => { pageRefs.current[pageNum] = el; }}
                style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}
              >
                {/*
                  canvasRef wrapper: display:inline-block shrinks to exactly
                  the canvas size. This is what we measure for label positioning.
                  No overlay is rendered here — labels live in GlobalMarkLayer instead.
                */}
                <div
                  ref={el => { canvasRefs.current[pageNum] = el; }}
                  style={{ display: 'inline-block', lineHeight: 0 }}
                >
                  <Page
                    pageNumber={pageNum}
                    width={pageRenderWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderSuccess={onPageRenderSuccess}
                    loading={
                      <div style={{ width: pageRenderWidth, height: Math.round(pageRenderWidth * 1.414), background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                        <LoadingSpinner size="sm" text={`Page ${pageNum}`} />
                      </div>
                    }
                  />
                </div>
              </div>
            );
          })}
        </Document>

        {numPages > 1 && (
          <div style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: '12px', color: '#94a3b8' }}>
            ↑ {numPages} pages total • Ctrl+scroll or zoom buttons to resize
          </div>
        )}

        {/* ── Global mark layer — ONE layer for ALL pages ── */}
        {numPages && (
          <GlobalMarkLayer
            markPositions={markPositions}
            canvasRefs={canvasRefs}
            scrollRef={scrollRef}
            numPages={numPages}
            onDragEnd={onDragEnd || (() => {})}
            onClearMark={onClearMark}
            readOnly={readOnly}
            tick={tick}   // used as rendering dependency to recompute positions
          />
        )}
      </div>
    </div>
  );
}

// ─── Public export ─────────────────────────────────────────────────────────────
/**
 * PDFViewer
 *
 * Props:
 *   url           – blob URL of the PDF
 *   markPositions – { [questionKey]: { value, x, y, page } }
 *   onPageChange  – (pageNum) => void
 *   onDragEnd     – (questionKey, newX, newY, newPage) => void
 *   onClearMark   – (questionKey) => void
 *   readOnly      – if true, labels are visible but not draggable
 */
export default function PDFViewer({ url, markPositions, onPageChange, onDragEnd, onClearMark, readOnly }) {
  return (
    <PDFErrorBoundary>
      <PDFViewerInner
        url={url}
        markPositions={markPositions}
        onPageChange={onPageChange}
        onDragEnd={onDragEnd}
        onClearMark={onClearMark}
        readOnly={readOnly}
      />
    </PDFErrorBoundary>
  );
}

const btnStyle = {
  width: '26px', height: '26px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '5px',
  color: 'var(--color-text)',
  cursor: 'pointer', fontSize: '15px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s',
  fontFamily: 'inherit', flexShrink: 0,
};
