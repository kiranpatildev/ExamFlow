import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  getAnswerSheetDetails, 
  getAnswerSheetPdf, 
  getTeacherBundleSheets,
  getDraftEvaluation,
  saveDraftEvaluation,
  submitEvaluation
} from '../../api/teacher';
import { getMarkingScheme } from '../../api/markingSchemes';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import MarkingForm from '../../components/MarkingForm';
import PDFViewer from '../../components/PDFViewer';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

class EvaluationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px', textAlign: 'center', background: '#fef2f2', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚨</div>
          <h2 style={{ color: '#991b1b', marginBottom: '8px' }}>Something went wrong loading this evaluation</h2>
          <p style={{ color: '#dc2626', marginBottom: '24px', maxWidth: '500px' }}>
            {this.state.error?.message || "An unexpected error occurred while fetching the required resources."}
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => window.history.back()}
          >
            ← Go Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function EvaluationScreenInner() {
  const { sheetId } = useParams();
  const [searchParams] = useSearchParams();
  const bundleId = searchParams.get('bundleId');
  const navigate = useNavigate();
  const { auth, logout } = useAuth();

  const [sheet, setSheet] = useState(null);
  const [scheme, setScheme] = useState(null);
  const [schemeError, setSchemeError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [existingResult, setExistingResult] = useState(null);
  const [sheetsList, setSheetsList] = useState([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setPdfError(null);
      setSchemeError(null);
      
      try {
        // Load details (MUST SUCCEED)
        const sRes = await getAnswerSheetDetails(sheetId);
        setSheet(sRes.data);

        // Load Scheme (Handle missing gracefully)
        // getMarkingScheme returns paginated { count, results: [...] }
        // NOTE: sRes.data.bundle is the bundle PK (integer).
        //       sRes.data.subject is the nested Subject object (from AnswerSheetSerializer).
        try {
          const subjectId = sRes.data.subject?.id;
          if (!subjectId) throw new Error('Subject ID not found on answer sheet');
          const schRes = await getMarkingScheme(subjectId);
          // Handle both paginated { results: [...] } and bare array / object responses
          const schemeData =
            schRes.data?.results?.[0] ||
            (Array.isArray(schRes.data) ? schRes.data[0] : null);
          if (!schemeData) throw new Error('No scheme found');
          setScheme(schemeData);
        } catch (err) {
          setSchemeError("No marking scheme has been defined for this subject. Please ask the examination department to create one before evaluation can begin.");
        }

        // Load PDF securely (Handle missing gracefully)
        try {
          const pdfRes = await getAnswerSheetPdf(sheetId);
          const objUrl = URL.createObjectURL(pdfRes.data);
          setPdfUrl(objUrl);
        } catch (err) {
          if (err.response?.status === 404) {
            setPdfError(err.response.data?.error || "PDF file not found on server. The answer sheet may not have been compiled correctly. Contact the scanning department.");
          } else {
            setPdfError("Failed to fetch PDF due to a server error.");
          }
        }

        // Load Draft or Final Result
        if (sRes.data.status === 'completed') {
          import('../../api/evaluations').then(m => m.getEvaluation(sheetId))
            .then(ev => { setExistingResult(ev.data); })
            .catch(() => {});
        } else {
          // Fetch draft
          const draftRes = await getDraftEvaluation(sheetId);
          if (draftRes.data.section_results) {
            setExistingResult(draftRes.data);
            toast('Loaded from saved draft', { icon: '📝' });
          } else {
            setExistingResult(null);
          }
        }

        // Load siblings if bundleId is specified
        if (bundleId) {
          const listRes = await getTeacherBundleSheets(bundleId);
          setSheetsList(listRes.data || []);
        }

      } catch (err) {
        // If master details fail (like sheet not found), throw to ErrorBoundary
        throw new Error(err.response?.data?.error || "Failed to load answer sheet details.");
      } finally {
        setLoading(false);
      }
    };
    
    // Revoke previous url
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    load();
  }, [sheetId, bundleId]);

  const currentIndex = sheetsList.findIndex(s => s.id === Number(sheetId));
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < sheetsList.length - 1;

  const navigateToSibling = (dir) => {
    if (dir === -1 && hasPrev) navigate(`/teacher/evaluate/${sheetsList[currentIndex - 1].id}?bundleId=${bundleId}`);
    if (dir === 1 && hasNext) navigate(`/teacher/evaluate/${sheetsList[currentIndex + 1].id}?bundleId=${bundleId}`);
  };

  const handleAutoSave = async (payload) => {
    if (sheet?.status === 'completed') return;
    await saveDraftEvaluation({ answer_sheet_id: sheetId, section_results: payload });
  };

  const handleSubmit = async (payload) => {
    if (!scheme) { toast.error('No marking scheme found.'); return; }
    if (pdfError) { toast.error('Cannot submit evaluation without a valid PDF.'); return; }

    try {
      await submitEvaluation({ answer_sheet_id: sheetId, section_results: payload });
      toast.success('Evaluation submitted successfully!');
      
      setSheet(prev => ({ ...prev, status: 'completed' }));
      
      if (bundleId) {
        toast('Moving to next unevaluated sheet...', { icon: '🚀' });
        setTimeout(async () => {
          try {
            const res = await getTeacherBundleSheets(bundleId);
            const nextPending = res.data.find(s => s.status !== 'completed' && s.id !== Number(sheetId));
            if (nextPending) {
              navigate(`/teacher/evaluate/${nextPending.id}?bundleId=${bundleId}`);
            } else {
              toast.success('Bundle completely evaluated!');
              navigate(`/teacher/bundle/${bundleId}`);
            }
          } catch {
            navigate(`/teacher/bundle/${bundleId}`);
          }
        }, 1500);
      } else {
        navigate('/teacher');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Submission failed.');
    }
  };

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

  const isCompleted = sheet?.status === 'completed';

  return (
    <div className="main-layout">
      <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />

      {/* overflow: hidden is critical — allows PDF and marking form to scroll independently */}
      <div className="main-content" style={{ overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
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
               {/* NOTE: sheet.bundle is a FK integer, subject info is on sheet.subject */}
               {sheet?.subject?.subject_name} — {sheet?.subject?.subject_code}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {sheetsList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg)', borderRadius: '8px', padding: '4px', border: '1px solid var(--color-border)' }}>
                <button 
                  className="btn btn-ghost" 
                  disabled={!hasPrev} 
                  onClick={() => navigateToSibling(-1)}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >← Prev</button>
                <div style={{ padding: '0 12px', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  Sheet {currentIndex + 1} of {sheetsList.length}
                </div>
                <button 
                  className="btn btn-ghost" 
                  disabled={!hasNext} 
                  onClick={() => navigateToSibling(1)}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >Next →</button>
              </div>
            )}
          </div>
        </div>

        {/* min-height: 0 prevents flex item from overflowing its container */}
        <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* ── PDF Panel ─────────────────────────────────────────────────
               overflow:hidden + minHeight:0 are BOTH required.
               They tell CSS Grid: constrain this cell, do not let it grow
               beyond the grid row height. Without them, the inner
               overflow:auto div has no bounded height → no scroll.
          ─────────────────────────────────────────────────────────────── */}
          <div style={{
            borderRight: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',   /* clips at grid cell boundary           */
            minHeight: 0,         /* allows shrinking below content height  */
          }}>
            {pdfUrl ? (
              /* PDF ready — viewer fills the entire left panel */
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <PDFViewer url={pdfUrl} />
              </div>
            ) : pdfError ? (
              /* PDF load failed */
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px', background: '#fef2f2',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '14px' }}>⚠️</div>
                <h3 style={{ color: '#991b1b', marginBottom: '8px' }}>PDF Not Available</h3>
                <p style={{
                  color: '#dc2626', maxWidth: '360px',
                  textAlign: 'center', fontSize: '14px', lineHeight: 1.6,
                }}>
                  {pdfError}
                </p>
              </div>
            ) : (
              /* PDF still loading */
              <div style={{
                flex: 1, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <LoadingSpinner size="lg" text="Loading PDF…" />
              </div>
            )}
          </div>

          {/* Marking form */}
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
