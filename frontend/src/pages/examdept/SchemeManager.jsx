import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSubjects, createSubject, updateSubject, deleteSubject,
  getMarkingSchemes, createMarkingScheme, updateMarkingScheme
} from '../../api/markingSchemes';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './ExamDashboard';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

function SectionBuilder({ sections, onChange }) {
  const addSection = () => {
    onChange([...sections, { section_name: '', questions: [{ question_no: '', max_marks: 0 }] }]);
  };
  const removeSection = (si) => onChange(sections.filter((_, i) => i !== si));
  const addQuestion = (si) => {
    const secs = sections.map((s, i) => i !== si ? s : {
      ...s, questions: [...s.questions, { question_no: '', max_marks: 0 }]
    });
    onChange(secs);
  };
  const removeQuestion = (si, qi) => {
    const secs = sections.map((s, i) => i !== si ? s : {
      ...s, questions: s.questions.filter((_, j) => j !== qi)
    });
    onChange(secs);
  };
  const updateSection = (si, field, val) => {
    onChange(sections.map((s, i) => i !== si ? s : { ...s, [field]: val }));
  };
  const updateQuestion = (si, qi, field, val) => {
    onChange(sections.map((s, i) => i !== si ? s : {
      ...s, questions: s.questions.map((q, j) => j !== qi ? q : { ...q, [field]: val })
    }));
  };

  const totalMarks = sections.reduce((t, s) => t + s.questions.reduce((st, q) => st + (parseInt(q.max_marks) || 0), 0), 0);

  return (
    <div>
      {sections.map((section, si) => (
        <div key={si} style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px', padding: '16px', marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center' }}>
            <input
              id={`section-name-${si}`}
              className="input"
              placeholder="Section name (e.g. Section A)"
              value={section.section_name}
              onChange={e => updateSection(si, 'section_name', e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              id={`remove-section-${si}`}
              className="btn btn-danger"
              style={{ padding: '6px 12px', flexShrink: 0 }}
              onClick={() => removeSection(si)}
            >Remove Section</button>
          </div>
          {section.questions.map((q, qi) => (
            <div key={qi} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <input
                id={`q-no-${si}-${qi}`}
                className="input"
                placeholder="Q No."
                value={q.question_no}
                onChange={e => updateQuestion(si, qi, 'question_no', e.target.value)}
                style={{ width: '80px' }}
              />
              <input
                id={`q-marks-${si}-${qi}`}
                type="number"
                min={0}
                className="input"
                placeholder="Max marks"
                value={q.max_marks}
                onChange={e => updateQuestion(si, qi, 'max_marks', parseInt(e.target.value) || 0)}
                style={{ width: '100px' }}
              />
              <span style={{ fontSize: '12px', color: '#64748b', minWidth: '40px' }}>marks</span>
              {section.questions.length > 1 && (
                <button
                  id={`remove-q-${si}-${qi}`}
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => removeQuestion(si, qi)}
                >✕</button>
              )}
            </div>
          ))}
          <button
            id={`add-question-${si}`}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '12px', marginTop: '4px' }}
            onClick={() => addQuestion(si)}
          >+ Add Question</button>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <button id="add-section-btn" className="btn btn-secondary" onClick={addSection}>
          + Add Section
        </button>
        <span style={{ fontSize: '14px', color: '#818cf8', fontWeight: 700 }}>
          Total: {totalMarks} marks
        </span>
      </div>
    </div>
  );
}

export default function SchemeManager() {
  const [subjects, setSubjects] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('subjects');
  const [editingScheme, setEditingScheme] = useState(null);  // { subjectId, sections, existingId }
  const [subjectForm, setSubjectForm] = useState({ subject_name: '', subject_code: '', department: '', semester: 1 });
  const [editingSubject, setEditingSubject] = useState(null);
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, schRes] = await Promise.all([getSubjects(), getMarkingSchemes()]);
      setSubjects(sRes.data.results || sRes.data);
      setSchemes(schRes.data.results || schRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaveSubject = async () => {
    if (!subjectForm.subject_name || !subjectForm.subject_code || !subjectForm.department) {
      toast.error('Fill all subject fields.'); return;
    }
    setSaving(true);
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, subjectForm);
        toast.success('Subject updated.');
      } else {
        await createSubject(subjectForm);
        toast.success('Subject created.');
      }
      setSubjectForm({ subject_name: '', subject_code: '', department: '', semester: 1 });
      setEditingSubject(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.subject_code?.[0] || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    try {
      await deleteSubject(id);
      toast.success('Subject deleted.');
      await load();
    } catch {
      toast.error('Cannot delete — subject may have active bundles.');
    }
  };

  const handleSaveScheme = async () => {
    if (!editingScheme) return;
    setSaving(true);
    try {
      const payload = { subject_id: editingScheme.subjectId, sections: editingScheme.sections };
      if (editingScheme.existingId) {
        await updateMarkingScheme(editingScheme.existingId, payload);
        toast.success('Marking scheme updated.');
      } else {
        await createMarkingScheme(payload);
        toast.success('Marking scheme created.');
      }
      setEditingScheme(null);
      await load();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.sections?.[0] || 'Save failed.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="main-layout">
      <Sidebar navigate={navigate} logout={logout} auth={auth} />

      <main className="main-content">
        <h1 className="gradient-text" style={{ marginBottom: '24px' }}>Subjects & Marking Schemes</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {['subjects', 'schemes'].map(tab => (
            <button
              key={tab}
              id={`tab-${tab}`}
              className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(tab)}
              style={{ padding: '7px 20px' }}
            >
              {tab === 'subjects' ? '📚 Subjects' : '📋 Marking Schemes'}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <LoadingSpinner size="lg" />
          </div>
        ) : activeTab === 'subjects' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Subject form */}
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>{editingSubject ? 'Edit Subject' : 'Add Subject'}</h3>
              {['subject_name', 'subject_code', 'department'].map(field => (
                <div className="form-group" key={field}>
                  <label className="form-label" htmlFor={`subject-${field}`}>
                    {field.replace('_', ' ').replace(/^./, c => c.toUpperCase())}
                  </label>
                  <input
                    id={`subject-${field}`}
                    className="input"
                    value={subjectForm[field]}
                    onChange={e => setSubjectForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={field.replace('_', ' ')}
                  />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label" htmlFor="subject-semester">Semester</label>
                <input
                  id="subject-semester"
                  type="number"
                  min={1} max={8}
                  className="input"
                  value={subjectForm.semester}
                  onChange={e => setSubjectForm(f => ({ ...f, semester: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  id="save-subject-btn"
                  className="btn btn-primary"
                  onClick={handleSaveSubject}
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  {saving ? <LoadingSpinner size="sm" /> : (editingSubject ? 'Update' : 'Create')}
                </button>
                {editingSubject && (
                  <button className="btn btn-secondary" onClick={() => { setEditingSubject(null); setSubjectForm({ subject_name: '', subject_code: '', department: '', semester: 1 }); }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Subject list */}
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>All Subjects ({subjects.length})</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {subjects.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px' }}>{s.subject_name}</p>
                      <p style={{ fontSize: '12px', color: '#64748b' }}>{s.subject_code} • Sem {s.semester} • {s.department}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        id={`edit-subject-${s.id}`}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => { setEditingSubject(s); setSubjectForm(s); }}
                      >Edit</button>
                      <button
                        id={`delete-subject-${s.id}`}
                        className="btn btn-danger"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleDeleteSubject(s.id)}
                      >Del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Marking Schemes */
          <div>
            {editingScheme ? (
              <div className="card fade-in-up">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3>Edit Marking Scheme</h3>
                  <button className="btn btn-secondary" onClick={() => setEditingScheme(null)}>Cancel</button>
                </div>
                <SectionBuilder
                  sections={editingScheme.sections}
                  onChange={sections => setEditingScheme(s => ({ ...s, sections }))}
                />
                <button
                  id="save-scheme-btn"
                  className="btn btn-primary"
                  onClick={handleSaveScheme}
                  disabled={saving}
                  style={{ marginTop: '16px', width: '100%', padding: '12px' }}
                >
                  {saving ? <><LoadingSpinner size="sm" /> Saving...</> : 'Save Marking Scheme'}
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ marginBottom: '16px' }}>Marking Schemes by Subject</h3>
                {subjects.map(sub => {
                  const scheme = schemes.find(sc => sc.subject?.id === sub.id);
                  return (
                    <div key={sub.id} className="card" style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontWeight: 600 }}>{sub.subject_name}</p>
                          <p style={{ fontSize: '13px', color: '#64748b' }}>{sub.subject_code}</p>
                          {scheme && (
                            <p style={{ fontSize: '13px', color: '#818cf8', marginTop: '4px' }}>
                              Total: {scheme.total_marks} marks • {scheme.sections?.length} sections
                            </p>
                          )}
                        </div>
                        <button
                          id={`edit-scheme-${sub.id}`}
                          className="btn btn-primary"
                          style={{ padding: '6px 16px' }}
                          onClick={() => setEditingScheme({
                            subjectId: sub.id,
                            sections: scheme?.sections || [{ section_name: 'Section A', questions: [{ question_no: '1', max_marks: 10 }] }],
                            existingId: scheme?.id || null,
                          })}
                        >
                          {scheme ? '✏️ Edit Scheme' : '+ Create Scheme'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
