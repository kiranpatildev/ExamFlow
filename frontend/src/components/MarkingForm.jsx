import { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

export default function MarkingForm({ scheme, existingResult, onSubmit, disabled, onAutoSave, onMarkChange }) {
  const [sectionData, setSectionData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

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
    // computeTotals returns the updated sections with section_total computed.
    // MUST use the returned value — the original initialSections has section_total: 0.
    const updatedSections = computeTotals(initialSections);
    setSectionData(updatedSections);
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
    // Only numbers and decimals
    if (value !== '' && isNaN(parseFloat(value))) return;
    
    setSectionData(prev => {
      const copy = prev.map((s, si) => si !== sIdx ? s : {
        ...s,
        questions: s.questions.map((q, qi) => qi !== qIdx ? q : {
          ...q,
          marks_obtained: value,
        }),
      });
      // Return computeTotals(copy) so section_total is updated in state,
      // AND setGrandTotal is called inside computeTotals.
      return computeTotals(copy);
    });
    
    // Notify parent so mark labels appear on the PDF overlay
    if (onMarkChange) {
      const sectionName = (sectionData[sIdx]?.section_name || `section_${sIdx}`)
        .toLowerCase().replace(/\s+/g, '_');
      const questionNo  = sectionData[sIdx]?.questions[qIdx]?.question_no || (qIdx + 1);
      const key = `${sectionName}_q${questionNo}`;
      onMarkChange(key, value);
    }
    
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[`${sIdx}-${qIdx}`];
      return copy;
    });
  };

  const validate = () => {
    const errs = {};
    let firstErrorId = null;
    sectionData.forEach((s, si) => {
      s.questions.forEach((q, qi) => {
        const v = parseFloat(q.marks_obtained);
        const errKey = `${si}-${qi}`;
        if (q.marks_obtained === '' || isNaN(v)) {
          errs[errKey] = 'Required';
          if (!firstErrorId) firstErrorId = `marks-input-${errKey}`;
        } else if (v < 0 || v > q.max_marks) {
          errs[errKey] = `0–${q.max_marks}`;
          if (!firstErrorId) firstErrorId = `marks-input-${errKey}`;
        }
      });
    });
    return { errs, firstErrorId };
  };

  const getPayload = () => {
    return sectionData.map(s => ({
      section_name: s.section_name,
      questions: s.questions.map(q => ({
        question_no: q.question_no,
        max_marks: q.max_marks,
        marks_obtained: parseFloat(q.marks_obtained) || 0,
      })),
    }));
  };

  const handleBlur = async () => {
    if (disabled || !onAutoSave) return;
    const payload = getPayload();
    try {
      await onAutoSave(payload);
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
    } catch (err) {
      // ignore draft save errors
    }
  };

  const handleSubmit = async () => {
    const { errs, firstErrorId } = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (firstErrorId) {
        document.getElementById(firstErrorId)?.focus();
        document.getElementById(firstErrorId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!window.confirm(`Submit evaluation?\nTotal marks: ${grandTotal} / ${scheme.total_marks}\nThis cannot be undone.`)) {
      return;
    }

    setSubmitting(true);
    await onSubmit(getPayload());
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
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
        background: 'var(--color-surface)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
            Marking Scheme
          </h3>
          <div style={{
            padding: '6px 16px',
            background: '#ebf4ff',
            border: '1px solid #c3dafe',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 700,
            color: '#5a67d8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            Total: {grandTotal} / {scheme.total_marks}
            {savedIndicator && <span style={{ fontSize: '11px', color: '#38a169', marginLeft: '4px' }}>• Saved</span>}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {sectionData.map((section, si) => (
          <div
            key={si}
            style={{
              background: '#f8fafc',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              marginBottom: '12px',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setCollapsed(prev => ({ ...prev, [si]: !prev[si] }))}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '12px 16px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-text)', fontSize: '14px', fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              <span>{section.section_name}</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-indigo)', fontWeight: 700 }}>
                  {section.section_total} marks
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  {collapsed[si] ? '▼' : '▲'}
                </span>
              </div>
            </button>

            {!collapsed[si] && (
              <div style={{ padding: '0 16px 16px' }}>
                {section.questions.map((q, qi) => {
                  const errKey = `${si}-${qi}`;
                  const hasErr = !!errors[errKey];
                  return (
                    <div key={qi} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '8px 0',
                      borderBottom: qi < section.questions.length - 1 ? '1px solid var(--color-border-2)' : 'none',
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
                        onBlur={handleBlur}
                        style={{
                          width: '72px', padding: '6px 10px',
                          background: hasErr ? '#fff5f5' : '#ffffff',
                          border: `1px solid ${hasErr ? 'var(--color-danger)' : 'var(--color-border)'}`,
                          color: 'var(--color-text)',
                          borderRadius: '8px', color: 'var(--color-text)', fontSize: '14px',
                          outline: 'none', textAlign: 'center',
                          opacity: isCompleted ? 0.6 : 1,
                        }}
                        placeholder="0"
                      />
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
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
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)', flexShrink: 0, background: 'var(--color-surface)' }}>
          <button
            id="submit-eval-btn"
            onClick={handleSubmit}
            disabled={submitting}
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
              <><LoadingSpinner size="sm" /> Submitting...</>
            ) : (
              'Submit Evaluation'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
