import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnswerSheets, assignTeacher } from '../../api/answerSheets';
import { getTeachers } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './ExamDashboard';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AssignTeacher() {
  const [sheets, setSheets] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [teacherMap, setTeacherMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [filters, setFilters] = useState({ status: '', subject_id: '' });
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, tRes] = await Promise.all([
        getAnswerSheets({ status: filters.status || undefined, page_size: 100 }),
        getTeachers(),
      ]);
      setSheets(sRes.data.results || []);
      setTeachers(tRes.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const handleSelectSheet = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (selected.length === 0) { toast.error('Select at least one sheet.'); return; }
    const assignableSheets = selected.filter(id => {
      const sheet = sheets.find(s => s.id === id);
      return sheet && !['under_evaluation', 'completed'].includes(sheet.status);
    });
    if (assignableSheets.length === 0) {
      toast.error('Selected sheets cannot be reassigned (already under evaluation or completed).');
      return;
    }

    setAssigning(true);
    let successCount = 0;
    let errCount = 0;

    for (const sheetId of assignableSheets) {
      const teacherId = teacherMap[sheetId];
      if (!teacherId) { errCount++; continue; }
      try {
        await assignTeacher(sheetId, teacherId);
        successCount++;
      } catch (err) {
        errCount++;
      }
    }

    setAssigning(false);
    if (successCount > 0) toast.success(`${successCount} sheet(s) assigned successfully.`);
    if (errCount > 0) toast.error(`${errCount} assignment(s) failed.`);
    setSelected([]);
    setTeacherMap({});
    await load();
  };

  const eligibleSheets = sheets.filter(s => !['under_evaluation', 'completed'].includes(s.status));

  return (
    <div className="main-layout">
      <Sidebar navigate={navigate} logout={logout} auth={auth} />

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 className="gradient-text" style={{ marginBottom: '6px' }}>Assign Teachers</h1>
            <p style={{ color: '#64748b' }}>Select answer sheets and assign them to teachers.</p>
          </div>
          {selected.length > 0 && (
            <button
              id="bulk-assign-btn"
              className="btn btn-primary"
              onClick={handleAssign}
              disabled={assigning}
            >
              {assigning ? <><LoadingSpinner size="sm" /> Assigning...</> : `✅ Assign ${selected.length} Sheet(s)`}
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <select
            id="status-filter"
            className="select"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            style={{ width: '180px' }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      onChange={e => setSelected(e.target.checked ? eligibleSheets.map(s => s.id) : [])}
                      checked={selected.length === eligibleSheets.length && eligibleSheets.length > 0}
                    />
                  </th>
                  <th>Roll Number</th>
                  <th>Subject</th>
                  <th>Bundle</th>
                  <th>Status</th>
                  <th>Current Teacher</th>
                  <th>Assign To</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map(s => {
                  const isDisabled = ['under_evaluation', 'completed'].includes(s.status);
                  return (
                    <tr key={s.id} style={{ opacity: isDisabled ? 0.5 : 1 }}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={isDisabled}
                          checked={selected.includes(s.id)}
                          onChange={() => handleSelectSheet(s.id)}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.roll_number}</td>
                      <td>
                        <div>{s.subject?.subject_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{s.subject?.subject_code}</div>
                      </td>
                      <td style={{ color: '#64748b' }}>#{s.bundle_number}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {s.assigned_teacher_detail?.full_name || '—'}
                      </td>
                      <td>
                        {!isDisabled && selected.includes(s.id) ? (
                          <select
                            id={`teacher-select-${s.id}`}
                            className="select"
                            value={teacherMap[s.id] || ''}
                            onChange={e => setTeacherMap(prev => ({ ...prev, [s.id]: e.target.value }))}
                            style={{ padding: '5px 8px', fontSize: '13px' }}
                          >
                            <option value="">Select teacher...</option>
                            {teachers.map(t => (
                              <option key={t.id} value={t.id}>{t.full_name}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: '#475569', fontSize: '13px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
