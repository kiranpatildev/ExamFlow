import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReports, exportExcel, exportPdf } from '../../api/reports';
import { getSubjects } from '../../api/markingSchemes';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
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
      background: '#ffffff',
      border: '1px solid var(--color-border)',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '14px',
      boxShadow: 'var(--shadow-xs)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px',
          background: '#f8fafc',
          border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
          color: 'var(--color-text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: '#ebf4ff', border: '1px solid #c3dafe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 800, color: 'var(--color-indigo)',
          }}>
            {student.roll_number.slice(-2)}
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>
              Roll No: {student.roll_number}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {student.subject_count} subject{student.subject_count !== 1 ? 's' : ''} evaluated
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>Grand Total</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--color-indigo)' }}>
              {student.grand_total}
            </p>
          </div>
          <span style={{ color: 'var(--color-text-dim)', fontSize: '12px' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 20px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
            <thead>
              <tr>
                {['Subject Code', 'Subject Name', 'Semester', 'Total Marks', 'Evaluated On'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', fontSize: '11px', fontWeight: 600,
                    color: 'var(--color-text-muted)', textAlign: 'left', textTransform: 'uppercase',
                    letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {student.subjects.map((s, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fafbfc' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--color-indigo)', fontSize: '13px' }}>
                    {s.subject_code}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--color-text)', fontSize: '13px' }}>
                    {s.subject_name}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center' }}>
                    {s.semester}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span className="badge badge-success">{s.total_marks}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                    {s.evaluated_at ? new Date(s.evaluated_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #c3dafe' }}>
                <td colSpan={3} style={{
                  padding: '10px 12px', textAlign: 'right',
                  fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '13px',
                }}>
                  GRAND TOTAL
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span className="badge badge-indigo" style={{ fontSize: '16px', padding: '4px 16px' }}>
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
      <AppSidebar role="exam_dept" userName={auth?.fullName || 'Admin'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Evaluation Reports</h1>
            <p>Filter by subject, date, or roll number to generate consolidated reports.</p>
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
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>View:</span>
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
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
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
                    <td style={{ fontFamily: 'monospace', color: 'var(--color-indigo)' }}>{r.subject_code}</td>
                    <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{r.semester}</td>
                    <td><span className="badge badge-success">{r.total_marks}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
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

        {!loading && results.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <h3>No results yet</h3>
              <p>Use the filters above and click "Run Report" to generate results.</p>
              <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                Tip: Enter a roll number to see that student's marks across all subjects.
              </p>
            </div>
          </div>
        )}
        </div>
        <footer className="main-footer">
          <span>© 2024 ExamFlow. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}


