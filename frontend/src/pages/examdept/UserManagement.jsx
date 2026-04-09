import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

const ROLE_META = {
  scanning_staff: { label: 'Scanning Staff', icon: '🖨️', bg: '#f0fff4', color: '#276749' },
  teacher:        { label: 'Teacher',         icon: '👩‍🏫', bg: '#ebf8ff', color: '#2b6cb0' },
  exam_dept:      { label: 'Exam Dept',        icon: '🏛️', bg: '#fffff0', color: '#744210' },
};

const EMPTY_FORM = { username: '', password: '', role: 'teacher', full_name: '', email: '' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [roleFilter, setRoleFilter] = useState('');
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getUsers(roleFilter ? { role: roleFilter } : {});
      setUsers(res.data);
    } catch { toast.error('Failed to load users.'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [roleFilter]);

  const openCreate = () => { setForm(EMPTY_FORM); setFormErrors({}); setEditingUser(null); setShowModal(true); };
  const openEdit = (u) => {
    setForm({ username: u.username, password: '', role: u.role, full_name: u.full_name, email: u.email });
    setFormErrors({}); setEditingUser(u); setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setFormErrors({});
    try {
      if (editingUser) {
        const payload = { full_name: form.full_name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await updateUser(editingUser.id, payload);
        toast.success('User updated.');
      } else {
        await createUser(form);
        toast.success('User created!');
      }
      setShowModal(false); await load();
    } catch (err) {
      const errs = err.response?.data;
      if (errs && typeof errs === 'object') setFormErrors(errs);
      else toast.error('Save failed.');
    }
    setSaving(false);
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete "${u.full_name}"?`)) return;
    try { await deleteUser(u.id); toast.success('Deleted.'); await load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Delete failed.'); }
  };

  const counts = {
    teacher: users.filter(u => u.role === 'teacher').length,
    scanning_staff: users.filter(u => u.role === 'scanning_staff').length,
    exam_dept: users.filter(u => u.role === 'exam_dept').length,
  };

  const tabs = [
    { key: '', label: 'All', icon: '👤' },
    { key: 'teacher', label: 'Teachers', icon: '👩‍🏫' },
    { key: 'scanning_staff', label: 'Scanning Staff', icon: '🖨️' },
    { key: 'exam_dept', label: 'Exam Dept', icon: '🏛️' },
  ];

  return (
    <div className="main-layout">
      <AppSidebar role="exam_dept" userName={auth?.fullName || 'Admin'} logout={logout} />

      <div className="main-content">
        <div className="content-body">
          {/* Header */}
          <div className="page-header">
            <div className="page-header-left">
              <h1>User Management</h1>
              <p>Manage staff, teachers, scanning staff, and admin accounts.</p>
            </div>
            <button id="create-user-btn" className="btn btn-primary" onClick={openCreate}>
              + Add User
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: 'Total Users', value: users.length, icon: '👥', bg: '#f7fafc' },
              { label: 'Teachers', value: counts.teacher, icon: '👩‍🏫', bg: '#ebf8ff' },
              { label: 'Scanning Staff', value: counts.scanning_staff, icon: '🖨️', bg: '#f0fff4' },
              { label: 'Exam Dept', value: counts.exam_dept, icon: '🏛️', bg: '#fffff0' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div>
                <div className="stat-card-info">
                  <div className="stat-card-value">{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="filter-tabs" style={{ marginBottom: '20px' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                id={`tab-${t.key || 'all'}`}
                className={`filter-tab ${roleFilter === t.key ? 'active' : ''}`}
                onClick={() => setRoleFilter(t.key)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}><LoadingSpinner size="lg" text="Loading users..." /></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          <div style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.3 }}>👤</div>
                          <h3>No users found. Click "Add User" to create one.</h3>
                          <button id="empty-add-btn" className="btn btn-primary" onClick={openCreate} style={{ marginTop: '12px' }}>
                            + Add User
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : users.map(u => {
                    const meta = ROLE_META[u.role] || {};
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '34px', height: '34px', borderRadius: '50%',
                              background: meta.bg || '#f7fafc',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '16px', flexShrink: 0,
                            }}>
                              {meta.icon || '👤'}
                            </div>
                            <span style={{ fontWeight: 500 }}>{u.full_name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: '13px' }}>
                          {u.username}
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{u.email}</td>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: '999px', fontSize: '12px',
                            fontWeight: 500, background: meta.bg, color: meta.color,
                          }}>
                            {meta.label || u.role}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              id={`edit-${u.id}`}
                              className="btn btn-secondary"
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                              onClick={() => openEdit(u)}
                            >Edit</button>
                            {u.id !== auth?.userId && (
                              <button
                                id={`del-${u.id}`}
                                className="btn btn-danger"
                                style={{ padding: '4px 12px', fontSize: '12px' }}
                                onClick={() => handleDelete(u)}
                              >Delete</button>
                            )}
                          </div>
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box fade-in-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Full Name *</label>
                <input id="fm-name" className={`input ${formErrors.full_name ? 'error' : ''}`}
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Priya Sharma" />
                {formErrors.full_name && <p className="error-text">{formErrors.full_name}</p>}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Role *</label>
                <select id="fm-role" className="select" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="teacher">Teacher</option>
                  <option value="scanning_staff">Scanning Staff</option>
                  <option value="exam_dept">Exam Department</option>
                </select>
              </div>

              {!editingUser && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Username *</label>
                  <input id="fm-username" className={`input ${formErrors.username ? 'error' : ''}`}
                    value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="e.g. priya.sharma" />
                  {formErrors.username && <p className="error-text">{formErrors.username}</p>}
                </div>
              )}

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{editingUser ? 'New Password (optional)' : 'Password *'}</label>
                <input id="fm-password" type="password" className={`input ${formErrors.password ? 'error' : ''}`}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editingUser ? 'Leave blank to keep' : 'Min. 6 characters'} />
                {formErrors.password && <p className="error-text">{formErrors.password}</p>}
              </div>

              <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label className="form-label">Email *</label>
                <input id="fm-email" type="email" className={`input ${formErrors.email ? 'error' : ''}`}
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. priya@college.edu" />
                {formErrors.email && <p className="error-text">{formErrors.email}</p>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button id="save-user-btn" className="btn btn-primary" style={{ flex: 1, padding: '10px' }}
                onClick={handleSave} disabled={saving}>
                {saving ? <><LoadingSpinner size="sm" /> Saving...</> : (editingUser ? 'Update User' : 'Create User')}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ padding: '10px 20px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
