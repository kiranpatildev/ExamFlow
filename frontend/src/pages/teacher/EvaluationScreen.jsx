import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getAnswerSheetDetails,
  getAnswerSheetPdf,
  getTeacherBundleSheets,
  getDraftEvaluation,
  saveDraftEvaluation,
  submitEvaluation,
} from '../../api/teacher';
import { getEvaluation, generateMarkedPdf } from '../../api/evaluations';
import { getMarkingScheme } from '../../api/markingSchemes';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import MarkingForm from '../../components/MarkingForm';
import PDFViewer from '../../components/PDFViewer';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

// ─── Error Boundary ──────────────────────────────────────────────────────────
class EvaluationErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: '60px', textAlign: 'center', background: '#fef2f2', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚨</div>
        <h2 style={{ color: '#991b1b', marginBottom: '8px' }}>Something went wrong loading this evaluation</h2>
        <p style={{ color: '#dc2626', marginBottom: '24px', maxWidth: '500px' }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        <button className="btn btn-primary" onClick={() => window.history.back()}>← Go Back</button>
      </div>
    );
    return this.props.children;
  }
}

// ─── Default x/y positions for new labels (offset per question so they don't stack)
function defaultPosition(questionIndex, page = 1) {
  const col = questionIndex % 5;
  const row = Math.floor(questionIndex / 5);
  return { x: 50 + col * 8, y: 25 + row * 9, page };
}

// ─── Main Inner Component ────────────────────────────────────────────────────
function EvaluationScreenInner() {
  const { sheetId }       = useParams();
  const [searchParams]    = useSearchParams();
  const bundleId          = searchParams.get('bundleId');
  const navigate          = useNavigate();
  const { auth, logout }  = useAuth();

  // Core data
  const [sheet, setSheet]               = useState(null);
  const [scheme, setScheme]             = useState(null);
  const [schemeError, setSchemeError]   = useState(null);
  const [pdfUrl, setPdfUrl]             = useState(null);
  const [markedPdfUrl, setMarkedPdfUrl] = useState(null);
  const [pdfError, setPdfError]         = useState(null);
  const [existingResult, setExistingResult] = useState(null);
  const [sheetsList, setSheetsList]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Current visible PDF page (driven by PDFViewer scroll detection)
  const [currentPdfPage, setCurrentPdfPage] = useState(1);

  // markPositions — single source of truth for draggable labels
  const [markPositions, setMarkPositions] = useState({});
  const questionIndexMap = useRef({}); // { [questionKey]: globalIndex }

  // ── Load everything ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setPdfError(null);
      setSchemeError(null);
      setMarkPositions({});
      setMarkedPdfUrl(null);

      try {
        // 1. Answer sheet details (required)
        const sRes = await getAnswerSheetDetails(sheetId);
        if (cancelled) return;
        const sheetData = sRes.data;
        setSheet(sheetData);

        // 2. Marking scheme
        try {
          const subjectId = sheetData.subject?.id;
          if (!subjectId) throw new Error('Subject ID missing');
          const schRes = await getMarkingScheme(subjectId);
          if (cancelled) return;
          const schemeData =
            schRes.data?.results?.[0] ||
            (Array.isArray(schRes.data) ? schRes.data[0] : null);
          if (!schemeData) throw new Error('No scheme found');
          setScheme(schemeData);

          // Build question index map for default positions
          const indexMap = {};
          let idx = 0;
          (schemeData.sections || []).forEach(section => {
            const sKey = (section.section_name || '').toLowerCase().replace(/\s+/g, '_');
            (section.questions || []).forEach(q => {
              indexMap[`${sKey}_q${q.question_no}`] = idx++;
            });
          });
          questionIndexMap.current = indexMap;
        } catch {
          if (!cancelled) setSchemeError('No marking scheme defined for this subject.');
        }

        // 3. Original PDF (always load it)
        try {
          const pdfRes = await getAnswerSheetPdf(sheetId);
          if (cancelled) return;
          const objUrl = URL.createObjectURL(pdfRes.data);
          setPdfUrl(objUrl);
        } catch (err) {
          if (!cancelled) setPdfError(
            err.response?.status === 404
              ? (err.response.data?.error || 'PDF not found. Contact scanning dept.')
              : 'Failed to fetch PDF.'
          );
        }

        // 4. Load draft OR final evaluation (includes mark_positions)
        if (sheetData.status === 'completed') {
          try {
            const evRes = await getEvaluation(sheetId);
            if (cancelled) return;
            const ev = evRes.data;
            setExistingResult(ev);

            // Restore mark overlay
            if (ev.mark_positions && Object.keys(ev.mark_positions).length > 0) {
              setMarkPositions(ev.mark_positions);
            }
            // Use marked PDF if available
            if (ev.marked_pdf_url) {
              setMarkedPdfUrl(ev.marked_pdf_url);
            }
          } catch {
            // Completed but evaluation record not accessible — show original PDF only
          }
        } else {
          try {
            const draftRes = await getDraftEvaluation(sheetId);
            if (cancelled) return;
            if (draftRes.data.section_results) {
              setExistingResult(draftRes.data);
              toast('Loaded from saved draft', { icon: '📝' });
              if (draftRes.data.mark_positions && Object.keys(draftRes.data.mark_positions).length > 0) {
                setMarkPositions(draftRes.data.mark_positions);
              }
            }
          } catch {
            // No draft — start fresh
          }
        }

        // 5. Sibling sheets for navigation
        if (bundleId) {
          try {
            const listRes = await getTeacherBundleSheets(bundleId);
            if (!cancelled) setSheetsList(listRes.data || []);
          } catch { /* ignore */ }
        }

      } catch (err) {
        if (!cancelled) throw new Error(err.response?.data?.error || 'Failed to load answer sheet details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Revoke previous blob URL
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
    load();
    return () => { cancelled = true; };
  }, [sheetId, bundleId]);

  // ── Sheet navigation ─────────────────────────────────────────────────────
  const currentIndex = sheetsList.findIndex(s => s.id === Number(sheetId));
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < sheetsList.length - 1;
  const navigateToSibling = (dir) => {
    if (dir === -1 && hasPrev) navigate(`/teacher/evaluate/${sheetsList[currentIndex - 1].id}?bundleId=${bundleId}`);
    if (dir === 1  && hasNext) navigate(`/teacher/evaluate/${sheetsList[currentIndex + 1].id}?bundleId=${bundleId}`);
  };

  // ── Mark overlay state management ──────────────────────────────────────────
  const handleMarkChange = useCallback((questionKey, value) => {
    setMarkPositions(prev => {
      const existing = prev[questionKey];
      const globalIdx = questionIndexMap.current[questionKey] ?? 0;
      const pos = existing
        ? { ...existing, value }
        : { value, ...defaultPosition(globalIdx, currentPdfPage) };
      return { ...prev, [questionKey]: { ...pos, value } };
    });
  }, [currentPdfPage]);

  const handleLabelDrag = useCallback((questionKey, newX, newY, newPage) => {
    if (newX === null || newX === undefined) return;
    setMarkPositions(prev => {
      if (!prev[questionKey]) return prev;
      return {
        ...prev,
        [questionKey]: {
          ...prev[questionKey],
          x: newX, y: newY,
          page: newPage ?? prev[questionKey]?.page ?? 1,
        },
      };
    });
  }, []);

  const handleClearMark = useCallback((questionKey) => {
    setMarkPositions(prev => {
      const copy = { ...prev };
      delete copy[questionKey];
      return copy;
    });
  }, []);

  // ── Auto-save draft ────────────────────────────────────────────────────────
  const handleAutoSave = useCallback(async (payload) => {
    if (sheet?.status === 'completed') return;
    await saveDraftEvaluation({
      answer_sheet_id: sheetId,
      section_results: payload,
      mark_positions: markPositions,
    });
  }, [sheetId, sheet?.status, markPositions]);

  // ── Final submit ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (payload) => {
    if (!scheme)  { toast.error('No marking scheme found.'); return; }
    if (pdfError) { toast.error('Cannot submit without a valid PDF.'); return; }

    try {
      const res = await submitEvaluation({
        answer_sheet_id: sheetId,
        section_results: payload,
        mark_positions: markPositions,
      });

      toast.success('Evaluation submitted successfully!');
      setSheet(prev => ({ ...prev, status: 'completed' }));

      if (res.data?.marked_pdf_url) {
        setMarkedPdfUrl(res.data.marked_pdf_url);
        toast('✅ Marks embedded into the answer sheet PDF', { duration: 4000 });
      }

      if (bundleId) {
        toast('Moving to next unevaluated sheet...', { icon: '🚀' });
        setTimeout(async () => {
          try {
            const listRes = await getTeacherBundleSheets(bundleId);
            const nextPending = listRes.data.find(
              s => s.status !== 'completed' && s.id !== Number(sheetId)
            );
            if (nextPending) {
              navigate(`/teacher/evaluate/${nextPending.id}?bundleId=${bundleId}`);
            } else {
              toast.success('Bundle completely evaluated!');
              navigate(`/teacher/bundle/${bundleId}`);
            }
          } catch { navigate(`/teacher/bundle/${bundleId}`); }
        }, 1800);
      } else {
        navigate('/teacher');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Submission failed.');
    }
  }, [scheme, pdfError, sheetId, markPositions, bundleId, navigate]);

  // ── On-demand "Generate Marked PDF" ──────────────────────────────────────
  const handleGenerateMarkedPdf = useCallback(async () => {
    setGeneratingPdf(true);
    try {
      const res = await generateMarkedPdf(sheetId);
      if (res.data?.marked_pdf_url) {
        setMarkedPdfUrl(res.data.marked_pdf_url);
        toast.success('Marked PDF generated! Switching view...');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'PDF generation failed.');
    } finally {
      setGeneratingPdf(false);
    }
  }, [sheetId]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="main-layout">
        <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />
        <div className="main-content" style={{ display: 'grid', gridTemplateColumns: '60% 40%', height: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--color-border)', background: '#f8fafc' }}>
            <LoadingSpinner size="lg" text="Loading PDF Viewer..." />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface)' }}>
            <LoadingSpinner size="lg" text="Loading Marking Scheme..." />
          </div>
        </div>
      </div>
    );
  }

  const isCompleted  = sheet?.status === 'completed';
  // Always use the marked PDF when available — it has the annotations baked in
  const activePdfUrl = (isCompleted && markedPdfUrl) ? markedPdfUrl : pdfUrl;

  const hasMarkPositions = Object.keys(markPositions).length > 0;

  return (
    <div className="main-layout">
      <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />

      <div className="main-content" style={{ overflow: 'hidden' }}>

        {/* ── Top bar ── */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => navigate(bundleId ? `/teacher/bundle/${bundleId}` : '/teacher')}>
              ← Back
            </button>
            <div>
              <p style={{ fontWeight: 700, fontSize: '16px' }}>
                Roll No: {sheet?.roll_number}
                {isCompleted && <span style={{ marginLeft: '12px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>Completed</span>}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {sheet?.subject?.subject_name} — {sheet?.subject?.subject_code}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Marked PDF status / generate button */}
            {isCompleted && markedPdfUrl && (
              <span style={{ fontSize: '12px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '999px', fontWeight: 600 }}>
                📄 Viewing annotated PDF
              </span>
            )}
            {isCompleted && !markedPdfUrl && hasMarkPositions && (
              <button
                onClick={handleGenerateMarkedPdf}
                disabled={generatingPdf}
                style={{ fontSize: '12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 12px', borderRadius: '999px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {generatingPdf ? <><LoadingSpinner size="sm" /> Generating...</> : '📄 Generate Marked PDF'}
              </button>
            )}

            {sheetsList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg)', borderRadius: '8px', padding: '4px', border: '1px solid var(--color-border)' }}>
                <button className="btn btn-ghost" disabled={!hasPrev} onClick={() => navigateToSibling(-1)} style={{ padding: '6px 12px', fontSize: '13px' }}>← Prev</button>
                <div style={{ padding: '0 12px', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  Sheet {currentIndex + 1} of {sheetsList.length}
                </div>
                <button className="btn btn-ghost" disabled={!hasNext} onClick={() => navigateToSibling(1)} style={{ padding: '6px 12px', fontSize: '13px' }}>Next →</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Split panels ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* PDF panel */}
          <div style={{ borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {activePdfUrl ? (
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <PDFViewer
                  url={activePdfUrl}
                  markPositions={markPositions}
                  onPageChange={setCurrentPdfPage}
                  onDragEnd={handleLabelDrag}
                  onClearMark={handleClearMark}
                  readOnly={isCompleted}
                />
              </div>
            ) : pdfError ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#fef2f2' }}>
                <div style={{ fontSize: '40px', marginBottom: '14px' }}>⚠️</div>
                <h3 style={{ color: '#991b1b', marginBottom: '8px' }}>PDF Not Available</h3>
                <p style={{ color: '#dc2626', maxWidth: '360px', textAlign: 'center', fontSize: '14px', lineHeight: 1.6 }}>{pdfError}</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner size="lg" text="Loading PDF…" />
              </div>
            )}
          </div>

          {/* Marking form panel */}
          <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {schemeError ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📋</div>
                <h3 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>Missing Marking Scheme</h3>
                <p style={{ fontSize: '14px', lineHeight: 1.5 }}>{schemeError}</p>
              </div>
            ) : scheme ? (
              <MarkingForm
                scheme={scheme}
                existingResult={existingResult}
                onSubmit={handleSubmit}
                disabled={isCompleted || !!pdfError}
                onAutoSave={handleAutoSave}
                onMarkChange={handleMarkChange}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EvaluationScreen() {
  return (
    <EvaluationErrorBoundary>
      <EvaluationScreenInner />
    </EvaluationErrorBoundary>
  );
}
