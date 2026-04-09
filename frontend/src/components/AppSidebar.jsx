import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = {
  exam_dept: [
    { icon: '⊞', label: 'Dashboard',          path: '/exam-dept' },
    { icon: '👥', label: 'Users',              path: '/exam-dept/users' },
    { icon: '👩‍🏫', label: 'Assign Teachers',  path: '/exam-dept/assign' },
    { icon: '📚', label: 'Subjects & Schemes', path: '/exam-dept/schemes' },
    { icon: '📊', label: 'Reports',            path: '/exam-dept/reports' },
  ],
  teacher: [
    { icon: '📄', label: 'My Assignments', path: '/teacher' },
  ],
  scanning_staff: [
    { icon: '📋', label: 'New Bundle', path: '/scanning' },
  ],
};

const ROLE_META = {
  exam_dept:      { label: 'Exam Department' },
  teacher:        { label: 'Teacher' },
  scanning_staff: { label: 'Scanning Staff' },
};

export default function AppSidebar({ role, userName, logout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = NAV_ITEMS[role] || [];
  const meta = ROLE_META[role] || {};

  const isActive = (path) => {
    const roots = ['/exam-dept', '/teacher', '/scanning'];
    if (roots.includes(path)) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🎓</div>
        <span className="sidebar-logo-text">ExamFlow</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {items.map(item => (
          <div
            key={item.path}
            id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user-label">{meta.label}</div>
        <div className="sidebar-user-name">{userName}</div>
        <button
          id="signout-btn"
          className="btn btn-secondary"
          onClick={logout}
          style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
