import { useState, useEffect } from 'react';
import { getBundles, assignBundle } from '../../api/bundles';
import { getTeachers } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AssignTeacher() {
  const [bundles, setBundles] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherMap, setTeacherMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [filters, setFilters] = useState({ status: '' });
  const { auth, logout } = useAuth();

  const load = async () => {
    setLoading(true);
    try {
      const [bRes, tRes] = await Promise.all([
        getBundles({ page_size: 100 }),
        getTeachers(),
      ]);
      setBundles(bRes.data.results || []);
      setTeachers(tRes.data);
    } catch {
      toast.error('Failed to load bundles or teachers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const handleAssign = async (bundleId) => {
    const teacherId = teacherMap[bundleId];
    if (!teacherId) {
      toast.error('Please select a teacher first.');
      return;
    }

    setAssigningId(bundleId);
    try {
      await assignBundle(bundleId, teacherId);
      toast.success(`Bundle assigned successfully.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed.');
    } finally {
      setAssigningId(null);
    }
  };

  // Derived filter logic for assignment status
  const displayedBundles = bundles.filter(b => {
    if (!filters.status) return true;
    const isAssigned = b.assignment_status === 'assigned' || b.assignment_status === 'under_evaluation' || b.assignment_status === 'completed';
    if (filters.status === 'pending') return b.assignment_status === 'pending' || !b.assignment_status;
    if (filters.status === 'assigned') return isAssigned;
    return true;
  });

  return (
    <div className="main-layout">
      <AppSidebar role="exam_dept" userName={auth?.fullName || 'Admin'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Assign Teachers</h1>
              <p>Assign entire bundles of answer sheets to teachers for evaluation.</p>
            </div>
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
          ) : displayedBundles.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <span style={{ fontSize: '32px', opacity: 0.5 }}>📦</span>
              <h3 style={{ marginTop: '16px' }}>No submitted bundles found.</h3>
              <p style={{ color: 'var(--color-text-muted)' }}>Scanning staff need to submit bundles before they can be assigned.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Bundle</th>
                    <th>Total Sheets</th>
                    <th>Status</th>
                    <th>Assign To</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedBundles.map(b => {
                    const isAssigned = ['assigned', 'under_evaluation', 'completed'].includes(b.assignment_status);
                    return (
                      <tr key={b.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.subject?.subject_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{b.subject?.subject_code}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>#{b.bundle_number}</td>
                        <td style={{ color: '#64748b' }}>{b.total_sheets} sheets</td>
                        <td>
                          {b.status === 'open' ? (
                            <span style={{ color: '#d97706', fontWeight: 600, fontSize: '13px' }}>Scanning...</span>
                          ) : isAssigned ? (
                            <span style={{ color: 'var(--color-indigo)', fontWeight: 600, fontSize: '13px' }}>
                              Assigned → {b.assigned_teacher_name}
                            </span>
                          ) : (
                            <StatusBadge status="pending" />
                          )}
                        </td>
                        <td>
                          {b.status === 'open' ? (
                            <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', padding: '6px 0' }}>
                              Not submitted yet
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <select
                              id={`teacher-select-${b.id}`}
                              className="select"
                              value={teacherMap[b.id] || ''}
                              onChange={e => setTeacherMap(prev => ({ ...prev, [b.id]: e.target.value }))}
                              style={{ padding: '6px 12px', fontSize: '13px', width: '200px' }}
                            >
                              <option value="">Select Teacher ▼</option>
                              {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.full_name}</option>
                              ))}
                            </select>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleAssign(b.id)}
                              disabled={assigningId === b.id || !teacherMap[b.id]}
                              style={{ padding: '6px 16px', fontSize: '13px' }}
                            >
                              {assigningId === b.id ? <LoadingSpinner size="sm" /> : isAssigned ? 'Reassign' : 'Assign'}
                            </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
