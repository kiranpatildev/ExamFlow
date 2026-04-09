import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnswerSheetDetail } from '../../api/answerSheets';
import { submitEvaluation } from '../../api/evaluations';
import { getMarkingScheme } from '../../api/markingSchemes';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import MarkingForm from '../../components/MarkingForm';
import PDFViewer from '../../components/PDFViewer';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function EvaluationScreen() {
  const { sheetId } = useParams();
  const [sheet, setSheet] = useState(null);
  const [scheme, setScheme] = useState(null);
  const [marks, setMarks] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const sRes = await getAnswerSheetDetail(sheetId);
        setSheet(sRes.data);
        const schRes = await getMarkingScheme(sRes.data.bundle?.subject_id);
        setScheme(schRes.data);
      } catch {
        toast.error('Could not load sheet details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sheetId]);

  const handleSubmit = async () => {
    if (!scheme) { toast.error('No marking scheme found.'); return; }
    const sectionResults = scheme.sections.map(sec => ({
      section_name: sec.section_name,
      questions: sec.questions.map(q => ({
        question_no: q.question_no,
        marks_awarded: Number(marks[`${sec.section_name}_${q.question_no}`] ?? 0),
        max_marks: q.max_marks,
      })),
    }));

    setSubmitting(true);
    try {
      await submitEvaluation({ answer_sheet_id: sheetId, section_results: sectionResults });
      toast.success('Evaluation submitted!');
      navigate('/teacher');
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="main-layout">
        <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" text="Loading sheet..." />
        </div>
      </div>
    );
  }

  return (
    <div className="main-layout">
      <AppSidebar role="teacher" userName={auth?.fullName || 'Teacher'} logout={logout} />

      <div className="main-content">
        {/* Top bar */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => navigate('/teacher')}>
              ← Back
            </button>
            <div>
              <p style={{ fontWeight: 700, fontSize: '15px' }}>
                Roll No: {sheet?.roll_number}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {sheet?.bundle?.subject_name} — {sheet?.bundle?.subject_code}
              </p>
            </div>
          </div>
          <button
            id="submit-eval-btn"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || sheet?.status === 'completed'}
            style={{ padding: '10px 24px' }}
          >
            {submitting
              ? <><LoadingSpinner size="sm" /> Submitting...</>
              : sheet?.status === 'completed' ? '✅ Already Submitted' : '✅ Submit Evaluation'}
          </button>
        </div>

        {/* Split panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, overflow: 'hidden' }}>
          {/* PDF viewer */}
          <div style={{
            borderRight: '1px solid var(--color-border)',
            overflow: 'auto',
            background: '#f4f6f9',
            padding: '20px',
          }}>
            <div style={{
              background: '#fff', border: '1px solid var(--color-border)',
              borderRadius: '10px', padding: '16px', marginBottom: '12px',
            }}>
              <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Answer Sheet PDF</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Roll: {sheet?.roll_number} • Pages: {sheet?.page_count || '—'}
              </p>
            </div>
            {sheet?.pdf_url ? (
              <PDFViewer url={sheet.pdf_url} />
            ) : (
              <div style={{
                height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', border: '1px dashed var(--color-border)', borderRadius: '10px',
                color: 'var(--color-text-muted)', flexDirection: 'column', gap: '8px',
              }}>
                <span style={{ fontSize: '36px', opacity: 0.3 }}>📄</span>
                <p style={{ fontSize: '13px' }}>PDF not available</p>
              </div>
            )}
          </div>

          {/* Marking form */}
          <div style={{ overflow: 'auto', padding: '20px' }}>
            {scheme ? (
              <>
                <h3 style={{ marginBottom: '16px' }}>Mark Entry</h3>
                <MarkingForm
                  scheme={scheme}
                  marks={marks}
                  onChange={setMarks}
                  disabled={sheet?.status === 'completed'}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}>📋</div>
                <p style={{ fontWeight: 600 }}>No marking scheme</p>
                <p style={{ fontSize: '13px', marginTop: '6px' }}>
                  Ask the exam department to create one for this subject.
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="main-footer">
          <span>© 2024 ExamFlow. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}
