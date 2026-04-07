import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './ExamDashboard';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  scanning_staff: { label: 'Scanning Staff', icon: '📷', color: '#10b981' },
  teacher: { label: 'Teacher', icon: '📝', color: '#6366f1' },
  exam_dept: { label: 'Exam Department', icon: '🏛️', color: '#f59e0b' },
};

const EMPTY_FORM = {
  username: '', password: '', role: 'teacher', full_name: '', email: '',
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = create mode
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
    } catch {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [roleFilter]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingUser(null);
    setShowModal(true);
  };

  const openEdit = (user) => {
    setForm({
      username: user.username,
      password: '',
      role: user.role,
      full_name: user.full_name,
      email: user.email,
    });
    setFormErrors({});
    setEditingUser(user);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormErrors({});
    try {
      if (editingUser) {
        // Update — only send password if filled in
        const payload = {
          full_name: form.full_name,
          email: form.email,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await updateUser(editingUser.id, payload);
        toast.success(`${form.full_name} updated.`);
      } else {
        await createUser(form);
        toast.success(`${form.full_name} created successfully!`);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      const errs = err.response?.data;
      if (errs && typeof errs === 'object') {
        setFormErrors(errs);
      } else {
        toast.error('Save failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.full_name}"? This cannot be undone.`)) return;
    try {
      await deleteUser(user.id);
      toast.success('User deleted.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed.');
    }
  };

  const counts = {
    total: users.length,
    teacher: users.filter(u => u.role === 'teacher').length,
    scanning_staff: users.filter(u => u.role === 'scanning_staff').length,
    exam_dept: users.filter(u => u.role === 'exam_dept').length,
  };

  return (
    <div className="main-layout">
      <Sidebar navigate={navigate} logout={logout} auth={auth} />

      <main className="main-content">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 className="gradient-text" style={{ marginBottom: '6px' }}>User Management</h1>
            <p style={{ color: '#64748b' }}>Create and manage staff, teachers, and admin accounts.</p>
          </div>
          <button id="create-user-btn" className="btn btn-primary" onClick={openCreate}>
            + Add User
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
          {[
            { label: 'Total Users', value: counts.total, color: '#6366f1', icon: '👥' },
            { label: 'Teachers', value: counts.teacher, color: '#6366f1', icon: '📝' },
            { label: 'Scanning Staff', value: counts.scanning_staff, color: '#10b981', icon: '📷' },
            { label: 'Exam Dept', value: counts.exam_dept, color: '#f59e0b', icon: '🏛️' },
          ].map(s => (
            <div key={s.label} className="card" style={{
              background: `linear-gradient(135deg, ${s.color}11, ${s.color}05)`,
              borderColor: `${s.color}22`, padding: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '20px' }}>{s.icon}</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
          {['', 'teacher', 'scanning_staff', 'exam_dept'].map(r => (
            <button
              key={r}
              id={`filter-${r || 'all'}`}
              className={`btn ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRoleFilter(r)}
              style={{ padding: '6px 16px', fontSize: '13px' }}
            >
              {r === '' ? 'All' : ROLE_LABELS[r].icon + ' ' + ROLE_LABELS[r].label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <LoadingSpinner size="lg" />
          </div>
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
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                      No users found. Click "+ Add User" to create one.
                    </td>
                  </tr>
                ) : users.map(u => {
                  const roleInfo = ROLE_LABELS[u.role] || {};
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: `linear-gradient(135deg, ${roleInfo.color}33, ${roleInfo.color}66)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', flexShrink: 0,
                          }}>
                            {roleInfo.icon}
                          </div>
                          <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                        </div>
                      </td>
                      <td style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{u.username}</td>
                      <td style={{ color: '#64748b', fontSize: '13px' }}>{u.email}</td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: '999px', fontSize: '12px',
                          fontWeight: 600, color: roleInfo.color,
                          background: `${roleInfo.color}18`,
                        }}>
                          {roleInfo.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            id={`edit-user-${u.id}`}
                            className="btn btn-secondary"
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                            onClick={() => openEdit(u)}
                          >
                            ✏️ Edit
                          </button>
                          {u.id !== auth?.userId && (
                            <button
                              id={`delete-user-${u.id}`}
                              className="btn btn-danger"
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                              onClick={() => handleDelete(u)}
                            >
                              🗑️ Delete
                            </button>
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
      </main>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box fade-in-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>{editingUser ? 'Edit User' : 'Create New User'}</h2>
              <button id="close-modal-btn" className="btn btn-secondary" style={{ padding: '5px 12px' }}
                onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Full Name *</label>
                <input
                  id="user-full-name"
                  className={`input ${formErrors.full_name ? 'error' : ''}`}
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Priya Sharma"
                />
                {formErrors.full_name && <p className="error-text">{formErrors.full_name}</p>}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Role *</label>
                <select
                  id="user-role"
                  className={`select ${formErrors.role ? 'error' : ''}`}
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="teacher">📝 Teacher</option>
                  <option value="scanning_staff">📷 Scanning Staff</option>
                  <option value="exam_dept">🏛️ Exam Department</option>
                </select>
                {formErrors.role && <p className="error-text">{formErrors.role}</p>}
              </div>

              {!editingUser && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Username *</label>
                  <input
                    id="user-username"
                    className={`input ${formErrors.username ? 'error' : ''}`}
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="e.g. priya.sharma"
                  />
                  {formErrors.username && <p className="error-text">{formErrors.username}</p>}
                </div>
              )}

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input
                  id="user-password"
                  type="password"
                  className={`input ${formErrors.password ? 'error' : ''}`}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Min. 6 characters'}
                />
                {formErrors.password && <p className="error-text">{formErrors.password}</p>}
              </div>

              <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label className="form-label">Email *</label>
                <input
                  id="user-email"
                  type="email"
                  className={`input ${formErrors.email ? 'error' : ''}`}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. priya@college.edu"
                />
                {formErrors.email && <p className="error-text">{formErrors.email}</p>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                id="save-user-btn"
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px' }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <><LoadingSpinner size="sm" /> Saving...</> : (editingUser ? '💾 Update User' : '✅ Create User')}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ padding: '12px 20px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
