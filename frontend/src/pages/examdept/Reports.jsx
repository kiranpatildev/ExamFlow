import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReports, exportExcel, exportPdf } from '../../api/reports';
import { getSubjects } from '../../api/markingSchemes';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './ExamDashboard';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Individual student card showing all subjects and grand total
function StudentCard({ student }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      overflow: 'hidden',
      marginBottom: '16px',
    }}>
      {/* Card header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px',
          background: 'rgba(46,64,87,0.7)',
          border: 'none', cursor: 'pointer',
          color: '#f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 800,
          }}>
            {student.roll_number.slice(-2)}
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>
              Roll No: {student.roll_number}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              {student.subject_count} subject{student.subject_count !== 1 ? 's' : ''} evaluated
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Grand Total</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#818cf8' }}>
              {student.grand_total}
            </p>
          </div>
          <span style={{ color: '#64748b', fontSize: '12px' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Subject table */}
      {open && (
        <div style={{ padding: '0 20px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
            <thead>
              <tr>
                {['Subject Code', 'Subject Name', 'Semester', 'Total Marks', 'Evaluated On'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', fontSize: '11px', fontWeight: 600,
                    color: '#64748b', textAlign: 'left', textTransform: 'uppercase',
                    letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {student.subjects.map((s, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#818cf8', fontSize: '13px' }}>
                    {s.subject_code}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: '#e2e8f0', fontSize: '13px' }}>
                    {s.subject_name}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                    {s.semester}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      fontWeight: 700, fontSize: '15px', color: '#10b981',
                      background: 'rgba(16,185,129,0.12)',
                      padding: '2px 12px', borderRadius: '999px',
                    }}>
                      {s.total_marks}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px' }}>
                    {s.evaluated_at ? new Date(s.evaluated_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {/* Grand total row */}
              <tr style={{ borderTop: '2px solid rgba(99,102,241,0.3)' }}>
                <td colSpan={3} style={{
                  padding: '10px 12px', textAlign: 'right',
                  fontWeight: 700, color: '#94a3b8', fontSize: '13px',
                }}>
                  GRAND TOTAL
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{
                    fontWeight: 800, fontSize: '18px', color: '#818cf8',
                    background: 'rgba(99,102,241,0.15)',
                    padding: '3px 16px', borderRadius: '999px',
                  }}>
                    {student.grand_total}
                  </span>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const [results, setResults] = useState([]);
  const [studentReports, setStudentReports] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'student'
  const [filters, setFilters] = useState({
    subject_id: '', date_from: '', date_to: '', roll_number: '',
  });
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getSubjects().then(res => setSubjects(res.data.results || res.data)).catch(() => {});
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.subject_id) params.subject_id = filters.subject_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.roll_number) params.roll_number = filters.roll_number;

      const res = await getReports(params);
      setResults(res.data.results || []);
      setStudentReports(res.data.student_reports || []);

      // If roll number filter → default to student view
      if (filters.roll_number) setViewMode('student');
    } catch {
      toast.error('Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const params = {};
      if (filters.subject_id) params.subject_id = filters.subject_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.roll_number) params.roll_number = filters.roll_number;

      const roll = filters.roll_number;
      if (type === 'excel') {
        const res = await exportExcel(params);
        downloadBlob(new Blob([res.data], { type: res.headers['content-type'] }),
          roll ? `student_report_${roll}.xlsx` : 'examflow_report.xlsx');
      } else {
        const res = await exportPdf(params);
        downloadBlob(new Blob([res.data], { type: 'application/pdf' }),
          roll ? `student_report_${roll}.pdf` : 'examflow_report.pdf');
      }
      toast.success('Downloaded successfully.');
    } catch {
      toast.error('Export failed.');
    } finally {
      setExporting('');
    }
  };

  // Build student groups from flat results (for live table view)
  const localStudentGroups = (() => {
    if (studentReports.length > 0) return studentReports;
    const map = {};
    results.forEach(r => {
      if (!map[r.roll_number]) map[r.roll_number] = { roll_number: r.roll_number, subjects: [], grand_total: 0, subject_count: 0 };
      map[r.roll_number].subjects.push(r);
      map[r.roll_number].grand_total += r.total_marks;
      map[r.roll_number].subject_count += 1;
    });
    return Object.values(map).sort((a, b) => a.roll_number.localeCompare(b.roll_number));
  })();

  return (
    <div className="main-layout">
      <Sidebar navigate={navigate} logout={logout} auth={auth} />

      <main className="main-content">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 className="gradient-text" style={{ marginBottom: '6px' }}>Evaluation Reports</h1>
            <p style={{ color: '#64748b' }}>
              Filter by subject, date, or roll number to generate consolidated reports.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button id="export-excel-btn" className="btn btn-success" onClick={() => handleExport('excel')} disabled={!!exporting || results.length === 0}>
              {exporting === 'excel' ? <LoadingSpinner size="sm" /> : '📊'} Excel
            </button>
            <button id="export-pdf-btn" className="btn btn-secondary" onClick={() => handleExport('pdf')} disabled={!!exporting || results.length === 0}>
              {exporting === 'pdf' ? <LoadingSpinner size="sm" /> : '📄'} PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Subject</label>
              <select id="subject-filter" className="select" value={filters.subject_id}
                onChange={e => setFilters(f => ({ ...f, subject_id: e.target.value }))}>
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_code} — {s.subject_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Date From</label>
              <input id="date-from" type="date" className="input" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Date To</label>
              <input id="date-to" type="date" className="input" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Roll Number</label>
              <input id="roll-filter" className="input" placeholder="e.g. 228089"
                value={filters.roll_number}
                onChange={e => setFilters(f => ({ ...f, roll_number: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button id="run-report-btn" className="btn btn-primary" onClick={loadReport} disabled={loading}>
              {loading ? <><LoadingSpinner size="sm" /> Loading...</> : '🔍 Run Report'}
            </button>
            {filters.roll_number && (
              <span style={{ fontSize: '13px', color: '#818cf8' }}>
                💡 Searching across all subjects for roll: <strong>{filters.roll_number}</strong>
              </span>
            )}
          </div>
        </div>

        {/* View toggle */}
        {results.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>View:</span>
            <button
              id="view-table"
              className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 16px', fontSize: '13px' }}
              onClick={() => setViewMode('table')}
            >📋 Table</button>
            <button
              id="view-student"
              className={`btn ${viewMode === 'student' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 16px', fontSize: '13px' }}
              onClick={() => setViewMode('student')}
            >👤 Student Cards ({localStudentGroups.length})</button>
            <span style={{ fontSize: '13px', color: '#475569', marginLeft: '8px' }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* TABLE VIEW */}
        {results.length > 0 && viewMode === 'table' && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Sem</th>
                  <th>Total Marks</th>
                  <th>Evaluated At</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.roll_number}</td>
                    <td>{r.subject_name}</td>
                    <td style={{ fontFamily: 'monospace', color: '#818cf8' }}>{r.subject_code}</td>
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>{r.semester}</td>
                    <td>
                      <span style={{
                        fontWeight: 700, color: '#10b981',
                        background: 'rgba(16,185,129,0.12)',
                        padding: '2px 12px', borderRadius: '999px', fontSize: '13px',
                      }}>
                        {r.total_marks}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {r.evaluated_at ? new Date(r.evaluated_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* STUDENT CARD VIEW */}
        {results.length > 0 && viewMode === 'student' && (
          <div>
            {localStudentGroups.map(student => (
              <StudentCard key={student.roll_number} student={student} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && results.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ color: '#94a3b8', marginBottom: '8px' }}>No results yet</h3>
            <p>Use the filters above and click "Run Report" to generate results.</p>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#334155' }}>
              Tip: Enter a roll number to see that student's marks across all subjects.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
