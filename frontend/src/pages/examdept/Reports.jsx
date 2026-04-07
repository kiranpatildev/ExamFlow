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

export default function Reports() {
  const [results, setResults] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
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

      if (type === 'excel') {
        const res = await exportExcel(params);
        downloadBlob(new Blob([res.data], { type: res.headers['content-type'] }), 'examflow_report.xlsx');
      } else {
        const res = await exportPdf(params);
        downloadBlob(new Blob([res.data], { type: 'application/pdf' }), 'examflow_report.pdf');
      }
      toast.success('Export downloaded.');
    } catch {
      toast.error('Export failed.');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="main-layout">
      <Sidebar navigate={navigate} logout={logout} auth={auth} />

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 className="gradient-text" style={{ marginBottom: '6px' }}>Evaluation Reports</h1>
            <p style={{ color: '#64748b' }}>Consolidated marks by roll number and subject.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              id="export-excel-btn"
              className="btn btn-success"
              onClick={() => handleExport('excel')}
              disabled={!!exporting}
            >
              {exporting === 'excel' ? <LoadingSpinner size="sm" /> : '📊'} Excel
            </button>
            <button
              id="export-pdf-btn"
              className="btn btn-secondary"
              onClick={() => handleExport('pdf')}
              disabled={!!exporting}
            >
              {exporting === 'pdf' ? <LoadingSpinner size="sm" /> : '📄'} PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Subject</label>
              <select
                id="subject-filter"
                className="select"
                value={filters.subject_id}
                onChange={e => setFilters(f => ({ ...f, subject_id: e.target.value }))}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_code} — {s.subject_name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date From</label>
              <input
                id="date-from"
                type="date"
                className="input"
                value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date To</label>
              <input
                id="date-to"
                type="date"
                className="input"
                value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Roll Number</label>
              <input
                id="roll-filter"
                className="input"
                placeholder="Search roll..."
                value={filters.roll_number}
                onChange={e => setFilters(f => ({ ...f, roll_number: e.target.value }))}
              />
            </div>
          </div>
          <button
            id="run-report-btn"
            className="btn btn-primary"
            onClick={loadReport}
            disabled={loading}
          >
            {loading ? <><LoadingSpinner size="sm" /> Loading...</> : '🔍 Run Report'}
          </button>
        </div>

        {/* Results table */}
        {results.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Total Marks</th>
                  <th>Sections</th>
                  <th>Evaluated At</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.roll_number}</td>
                    <td>{r.subject_name}</td>
                    <td style={{ color: '#64748b' }}>{r.subject_code}</td>
                    <td>
                      <span style={{
                        fontWeight: 700, color: '#818cf8',
                        background: 'rgba(99,102,241,0.12)',
                        padding: '2px 10px', borderRadius: '999px', fontSize: '13px',
                      }}>
                        {r.total_marks}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {r.sections?.map(s => `${s.section_name}: ${s.section_total || 0}`).join(' | ')}
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

        {!loading && results.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <p>Run the report to see evaluation results.</p>
          </div>
        )}
      </main>
    </div>
  );
}
