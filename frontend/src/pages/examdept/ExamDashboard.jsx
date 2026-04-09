import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBundles } from '../../api/bundles';
import { getAnswerSheets } from '../../api/answerSheets';
import { useAuth } from '../../context/AuthContext';
import AppSidebar from '../../components/AppSidebar';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_FILTERS = ['all', 'open', 'submitted', 'assigned', 'completed'];

const SORT_FIELDS = [
  { key: 'subject',  label: 'Subject'   },
  { key: 'bundle',   label: 'Bundle #'  },
  { key: 'status',   label: 'Status'    },
  { key: 'date',     label: 'Date'      },
];

function SortIcon({ active, dir }) {
  if (!active) return <span style={{ color: '#cbd5e0', fontSize: '10px' }}>↕</span>;
  return <span style={{ color: '#5a67d8', fontSize: '10px' }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function SubjectTag({ name, code }) {
  return (
    <div>
      <div style={{ fontWeight: 500 }}>{name}</div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{code}</div>
    </div>
  );
}

function BundleRow({ b, navigate }) {
  return (
    <tr
      key={b.id}
      style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/exam-dept/bundle/${b.id}`)}
      onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      <td style={{ fontWeight: 600, color: '#5a67d8' }}>#{b.bundle_number}</td>
      <td><SubjectTag name={b.subject?.subject_name} code={b.subject?.subject_code} /></td>
      <td><StatusBadge status={b.status} /></td>
      <td style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
        {new Date(b.created_at).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </td>
    </tr>
  );
}

export default function ExamDashboard() {
  const [bundles, setBundles]       = useState([]);
  const [sheets, setSheets]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [sortField, setSortField]   = useState('subject');
  const [sortDir, setSortDir]       = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode]     = useState('grouped'); // 'flat' | 'grouped'
  const [collapsed, setCollapsed]   = useState({});        // { [subjectName]: bool }
  const [search, setSearch]         = useState('');

  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [bRes, sRes] = await Promise.all([
          getBundles({}),
          getAnswerSheets({ page_size: 100 }),
        ]);
        setBundles(bRes.data.results || []);
        setSheets(sRes.data.results || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  // ── Sort handler (toggle dir if same field, else reset to asc) ──────────────
  const handleSort = (field) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── Filtered + sorted bundles ───────────────────────────────────────────────
  const processed = useMemo(() => {
    let list = [...bundles];

    // Status filter
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter);

    // Search (bundle number or subject name)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(b =>
        String(b.bundle_number).toLowerCase().includes(q) ||
        b.subject?.subject_name?.toLowerCase().includes(q) ||
        b.subject?.subject_code?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let va = '', vb = '';
      if (sortField === 'subject') { va = a.subject?.subject_name ?? ''; vb = b.subject?.subject_name ?? ''; }
      if (sortField === 'bundle')  { va = String(a.bundle_number ?? ''); vb = String(b.bundle_number ?? ''); }
      if (sortField === 'status')  { va = a.status ?? '';                vb = b.status ?? ''; }
      if (sortField === 'date')    { va = a.created_at ?? '';            vb = b.created_at ?? ''; }
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [bundles, sortField, sortDir, statusFilter, search]);

  // ── Grouped view: subject name → bundles[] ─────────────────────────────────
  const grouped = useMemo(() => {
    const map = {};
    processed.forEach(b => {
      const key  = b.subject?.subject_name || 'Unknown Subject';
      const code = b.subject?.subject_code || '';
      if (!map[key]) map[key] = { code, bundles: [] };
      map[key].bundles.push(b);
    });
    return Object.entries(map).sort(([a], [b]) =>
      sortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
    );
  }, [processed, sortDir]);

  const toggleCollapse = (key) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Total Sheets',  value: sheets.length,                                   icon: '📄', bg: '#ebf8ff', ib: '#bee3f8' },
    { label: 'Pending',       value: sheets.filter(s => s.status === 'pending').length, icon: '⏳', bg: '#fffff0', ib: '#fefcbf' },
    { label: 'Assigned',      value: sheets.filter(s => s.status === 'assigned').length,icon: '👩‍🏫',bg: '#f0f5ff', ib: '#c3dafe' },
    { label: 'Completed',     value: sheets.filter(s => s.status === 'completed').length,icon: '✅',bg: '#f0fff4', ib: '#c6f6d5' },
  ];

  const thStyle = (field) => ({
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    color: sortField === field ? '#5a67d8' : 'var(--color-text-muted)',
    fontWeight: sortField === field ? 700 : 600,
  });

  return (
    <div className="main-layout">
      <AppSidebar role="exam_dept" userName={auth?.fullName || 'Admin'} logout={logout} />

      <div className="main-content">
        <div className="content-body">

          {/* Header */}
          <div className="page-header">
            <div className="page-header-left">
              <h1>Dashboard</h1>
              <p>Overview of all bundles and answer sheets.</p>
            </div>
            <button id="go-assign-btn" className="btn btn-primary" onClick={() => navigate('/exam-dept/assign')}>
              + Assign Teachers
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
            {stats.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-card-icon" style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <div className="stat-card-info">
                  <div className="stat-card-value">{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bundles table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* ── Table header bar ── */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex', flexWrap: 'wrap', gap: '12px',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, flexShrink: 0 }}>All Bundles</h3>
              <span style={{
                fontSize: '12px', fontWeight: 600, color: '#fff',
                background: '#5a67d8', borderRadius: '999px', padding: '2px 10px',
                flexShrink: 0,
              }}>
                {processed.length}
              </span>

              {/* Search */}
              <input
                id="bundle-search"
                type="text"
                placeholder="Search bundle or subject…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: '1 1 180px', maxWidth: '280px',
                  padding: '6px 12px', fontSize: '13px',
                  border: '1px solid var(--color-border)', borderRadius: '8px',
                  background: '#f8fafc', color: 'var(--color-text)', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />

              {/* Status filter chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {STATUS_FILTERS.map(s => (
                  <button
                    key={s}
                    id={`filter-${s}`}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: '4px 12px', fontSize: '12px', fontWeight: 600,
                      borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${statusFilter === s ? '#5a67d8' : 'var(--color-border)'}`,
                      background: statusFilter === s ? '#ebf4ff' : '#fff',
                      color: statusFilter === s ? '#5a67d8' : 'var(--color-text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* View mode toggle */}
              <div style={{
                marginLeft: 'auto', display: 'flex', gap: '4px',
                background: '#f1f5f9', borderRadius: '8px', padding: '3px',
              }}>
                {[['grouped', '⊞ By Subject'], ['flat', '☰ Table']].map(([mode, label]) => (
                  <button
                    key={mode}
                    id={`view-${mode}`}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: '5px 12px', fontSize: '12px', fontWeight: 600,
                      borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
                      border: 'none',
                      background: viewMode === mode ? '#fff' : 'transparent',
                      color: viewMode === mode ? '#5a67d8' : '#64748b',
                      boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Content ── */}
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <LoadingSpinner size="lg" text="Loading bundles…" />
              </div>
            ) : processed.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <h3>No bundles found</h3>
                <p>{search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Bundles appear here once scanning staff submit them.'}</p>
              </div>
            ) : viewMode === 'grouped' ? (

              /* ═══ GROUPED VIEW ═══════════════════════════════════════════ */
              <div style={{ padding: '8px 0' }}>
                {grouped.map(([subjectName, { code, bundles: subBundles }]) => {
                  const isOpen = !collapsed[subjectName];
                  const counts = {
                    open:      subBundles.filter(b => b.status === 'open').length,
                    submitted: subBundles.filter(b => b.status === 'submitted').length,
                    completed: subBundles.filter(b => b.status === 'completed').length,
                  };
                  return (
                    <div key={subjectName} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Subject header row */}
                      <button
                        onClick={() => toggleCollapse(subjectName)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 20px', background: '#f8fafc',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'inherit', borderBottom: isOpen ? '1px solid #e2e8f0' : 'none',
                        }}
                      >
                        {/* Collapse arrow */}
                        <span style={{
                          fontSize: '12px', color: '#94a3b8', flexShrink: 0,
                          transition: 'transform 0.2s',
                          display: 'inline-block',
                          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        }}>▼</span>

                        {/* Subject name */}
                        <div style={{ flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                            {subjectName}
                          </span>
                          {code && (
                            <span style={{
                              marginLeft: '8px', fontSize: '11px', fontWeight: 600,
                              color: '#5a67d8', background: '#ebf4ff',
                              padding: '1px 7px', borderRadius: '999px',
                            }}>
                              {code}
                            </span>
                          )}
                        </div>

                        {/* Count badge */}
                        <span style={{
                          fontSize: '12px', fontWeight: 600, color: '#64748b',
                          background: '#e2e8f0', borderRadius: '999px', padding: '1px 10px',
                        }}>
                          {subBundles.length} bundle{subBundles.length !== 1 ? 's' : ''}
                        </span>

                        {/* Status mini-summary */}
                        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                          {counts.open      > 0 && <span style={miniTag('#fff7ed','#c2410c')}>Open: {counts.open}</span>}
                          {counts.submitted > 0 && <span style={miniTag('#eff6ff','#1d4ed8')}>Submitted: {counts.submitted}</span>}
                          {counts.completed > 0 && <span style={miniTag('#f0fdf4','#15803d')}>Done: {counts.completed}</span>}
                        </div>
                      </button>

                      {/* Bundles under this subject */}
                      {isOpen && (
                        <table className="data-table" style={{ marginBottom: 0 }}>
                          <thead>
                            <tr>
                              {SORT_FIELDS.filter(f => f.key !== 'subject').map(({ key, label }) => (
                                <th
                                  key={key}
                                  style={thStyle(key)}
                                  onClick={() => handleSort(key)}
                                >
                                  {label} <SortIcon active={sortField === key} dir={sortDir} />
                                </th>
                              ))}
                              {/* subject col hidden in grouped view */}
                            </tr>
                          </thead>
                          <tbody>
                            {subBundles.map(b => (
                              <tr
                                key={b.id}
                                style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                                onClick={() => navigate(`/exam-dept/bundle/${b.id}`)}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0f5ff'}
                                onMouseLeave={e => e.currentTarget.style.background = ''}
                              >
                                <td style={{ fontWeight: 700, color: '#5a67d8', paddingLeft: '40px' }}>
                                  #{b.bundle_number}
                                </td>
                                <td><StatusBadge status={b.status} /></td>
                                <td style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                                  {new Date(b.created_at).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>

            ) : (

              /* ═══ FLAT TABLE VIEW ════════════════════════════════════════ */
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {SORT_FIELDS.map(({ key, label }) => (
                        <th
                          key={key}
                          style={thStyle(key)}
                          onClick={() => handleSort(key)}
                        >
                          {label} <SortIcon active={sortField === key} dir={sortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {processed.map(b => (
                      <BundleRow key={b.id} b={b} navigate={navigate} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button id="go-users-btn"   className="btn btn-secondary" onClick={() => navigate('/exam-dept/users')}>👥 Manage Users</button>
            <button id="go-schemes-btn" className="btn btn-secondary" onClick={() => navigate('/exam-dept/schemes')}>📚 Subjects &amp; Schemes</button>
            <button id="go-reports-btn" className="btn btn-secondary" onClick={() => navigate('/exam-dept/reports')}>📊 View Reports</button>
          </div>
        </div>

        <footer className="main-footer">
          <span>© 2024 ExamFlow. All rights reserved.</span>
          <span>College Examination Management System</span>
        </footer>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const miniTag = (bg, color) => ({
  padding: '1px 8px', borderRadius: '999px',
  fontSize: '11px', fontWeight: 600,
  background: bg, color,
});
