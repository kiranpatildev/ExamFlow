import { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

export default function MarkingForm({ scheme, existingResult, onSubmit, disabled }) {
  const [sectionData, setSectionData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!scheme?.sections) return;
    const initialSections = scheme.sections.map((section) => ({
      section_name: section.section_name,
      questions: section.questions.map((q) => {
        const existing = existingResult?.section_results
          ?.find(s => s.section_name === section.section_name)
          ?.questions?.find(eq => eq.question_no === q.question_no);
        return {
          question_no: q.question_no,
          max_marks: q.max_marks,
          marks_obtained: existing?.marks_obtained ?? '',
        };
      }),
      section_total: 0,
    }));
    computeTotals(initialSections);
    setSectionData(initialSections);
  }, [scheme, existingResult]);

  const computeTotals = (sections) => {
    let grand = 0;
    const updated = sections.map(s => {
      let sTotal = 0;
      s.questions.forEach(q => {
        const v = parseFloat(q.marks_obtained);
        if (!isNaN(v)) sTotal += v;
      });
      grand += sTotal;
      return { ...s, section_total: sTotal };
    });
    setGrandTotal(grand);
    return updated;
  };

  const handleMarkChange = (sIdx, qIdx, value) => {
    setSectionData(prev => {
      const copy = prev.map((s, si) => si !== sIdx ? s : {
        ...s,
        questions: s.questions.map((q, qi) => qi !== qIdx ? q : {
          ...q,
          marks_obtained: value,
        }),
      });
      computeTotals(copy);
      return copy;
    });
    // Clear error for this field
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[`${sIdx}-${qIdx}`];
      return copy;
    });
  };

  const validate = () => {
    const errs = {};
    sectionData.forEach((s, si) => {
      s.questions.forEach((q, qi) => {
        const v = parseFloat(q.marks_obtained);
        if (q.marks_obtained === '' || isNaN(v)) {
          errs[`${si}-${qi}`] = 'Required';
        } else if (v < 0 || v > q.max_marks) {
          errs[`${si}-${qi}`] = `0–${q.max_marks}`;
        }
      });
    });
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    const payload = sectionData.map(s => ({
      section_name: s.section_name,
      questions: s.questions.map(q => ({
        question_no: q.question_no,
        max_marks: q.max_marks,
        marks_obtained: parseFloat(q.marks_obtained),
      })),
    }));
    await onSubmit(payload);
    setSubmitting(false);
  };

  const [collapsed, setCollapsed] = useState({});

  if (!scheme) {
    return (
      <div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center' }}>
        No marking scheme found for this subject.
      </div>
    );
  }

  const isCompleted = disabled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>
            Marking Scheme
          </h3>
          <div style={{
            padding: '6px 16px',
            background: 'rgba(99,102,241,0.15)',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 700,
            color: '#818cf8',
          }}>
            Total: {grandTotal} / {scheme.total_marks}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {sectionData.map((section, si) => (
          <div
            key={si}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px',
              marginBottom: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Section header */}
            <button
              id={`section-toggle-${si}`}
              onClick={() => setCollapsed(prev => ({ ...prev, [si]: !prev[si] }))}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '12px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#e2e8f0', fontSize: '14px', fontWeight: 600,
              }}
            >
              <span>{section.section_name}</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>
                  {section.section_total} marks
                </span>
                <span style={{ color: '#64748b', fontSize: '12px' }}>
                  {collapsed[si] ? '▼' : '▲'}
                </span>
              </div>
            </button>

            {/* Questions */}
            {!collapsed[si] && (
              <div style={{ padding: '0 16px 16px' }}>
                {section.questions.map((q, qi) => {
                  const errKey = `${si}-${qi}`;
                  const hasErr = !!errors[errKey];
                  return (
                    <div key={qi} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '8px 0',
                      borderBottom: qi < section.questions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                      <span style={{ fontSize: '13px', color: '#94a3b8', minWidth: '80px' }}>
                        Q{q.question_no}
                      </span>
                      <input
                        id={`marks-input-${si}-${qi}`}
                        type="number"
                        min={0}
                        max={q.max_marks}
                        step="0.5"
                        value={q.marks_obtained}
                        disabled={isCompleted}
                        onChange={e => handleMarkChange(si, qi, e.target.value)}
                        style={{
                          width: '72px', padding: '6px 10px',
                          background: hasErr ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${hasErr ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '8px', color: '#f1f5f9', fontSize: '14px',
                          outline: 'none', textAlign: 'center',
                          opacity: isCompleted ? 0.6 : 1,
                        }}
                        placeholder="0"
                      />
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        / {q.max_marks}
                      </span>
                      {hasErr && (
                        <span style={{ fontSize: '11px', color: '#ef4444' }}>
                          {errors[errKey]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      {!isCompleted && (
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <button
            id="submit-evaluation-btn"
            onClick={handleSubmit}
            disabled={submitting || Object.keys(errors).length > 0}
            style={{
              width: '100%', padding: '12px',
              background: submitting ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', borderRadius: '10px',
              color: '#fff', fontSize: '15px', fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" /> Submitting...
              </>
            ) : (
              'Submit Evaluation'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
