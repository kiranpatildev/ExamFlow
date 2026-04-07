import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnswerSheets, getAnswerSheetPdfUrl } from '../../api/answerSheets';
import { getMarkingSchemes } from '../../api/markingSchemes';
import { submitEvaluation, getEvaluation } from '../../api/evaluations';
import PDFViewer from '../../components/PDFViewer';
import MarkingForm from '../../components/MarkingForm';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';
import axiosInstance from '../../api/axiosInstance';

export default function EvaluationScreen() {
  const { sheetId } = useParams();
  const navigate = useNavigate();

  const [sheet, setSheet] = useState(null);
  const [scheme, setScheme] = useState(null);
  const [existingEval, setExistingEval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // Load sheet details
        const sheetRes = await axiosInstance.get(`/api/answer-sheets/`);
        const allSheets = sheetRes.data.results || [];
        const found = allSheets.find(s => s.id === parseInt(sheetId));
        if (!found) throw new Error('Sheet not found');
        setSheet(found);

        // Load marking scheme for this subject
        const schemesRes = await getMarkingSchemes();
        const schemes = schemesRes.data.results || schemesRes.data;
        const matchScheme = schemes.find(sc => sc.subject?.id === found.subject?.id);
        setScheme(matchScheme || null);

        // Load existing evaluation if any
        try {
          const evalRes = await getEvaluation(parseInt(sheetId));
          setExistingEval(evalRes.data);
        } catch {
          // no evaluation yet — that's fine
        }

        // Set PDF URL
        const token = localStorage.getItem('access_token');
        const pUrl = getAnswerSheetPdfUrl(sheetId);
        setPdfUrl(pUrl);

      } catch (err) {
        setError('Failed to load evaluation screen. ' + (err.message || ''));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sheetId]);

  const handleSubmitEvaluation = async (sectionResults) => {
    try {
      await submitEvaluation({
        answer_sheet_id: parseInt(sheetId),
        section_results: sectionResults,
      });
      toast.success('Evaluation submitted successfully!');
      setSheet(prev => ({ ...prev, status: 'completed' }));
      // Reload evaluation
      const evalRes = await getEvaluation(parseInt(sheetId));
      setExistingEval(evalRes.data);
    } catch (err) {
      const errs = err.response?.data?.section_results || err.response?.data?.error;
      const msg = Array.isArray(errs) ? errs.join(', ') : (errs || 'Submission failed.');
      toast.error(msg);
      throw err; // re-throw so MarkingForm knows it failed
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg)',
      }}>
        <LoadingSpinner size="lg" text="Loading evaluation screen..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  const isCompleted = sheet?.status === 'completed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button id="back-btn" className="btn btn-secondary" style={{ padding: '6px 14px' }} onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Roll: {sheet?.roll_number}</span>
            <span style={{ marginLeft: '12px' }}>
              <StatusBadge status={sheet?.status} />
            </span>
          </div>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          {sheet?.subject?.subject_name} ({sheet?.subject?.subject_code})
        </div>
      </header>

      {/* Split panels */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* PDF panel — 60% */}
        <div style={{ flex: '0 0 60%', borderRight: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <PDFViewer url={pdfUrl} />
        </div>

        {/* Marking panel — 40% */}
        <div style={{ flex: '0 0 40%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isCompleted && existingEval && (
            <div className="alert alert-success" style={{ margin: '16px', borderRadius: '10px' }}>
              ✅ Evaluated — Total: <strong>{existingEval.total_marks}</strong> marks
            </div>
          )}
          <MarkingForm
            scheme={scheme}
            existingResult={existingEval}
            onSubmit={handleSubmitEvaluation}
            disabled={isCompleted}
          />
        </div>
      </div>
    </div>
  );
}
