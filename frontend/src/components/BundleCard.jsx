import StatusBadge from './StatusBadge';

export default function BundleCard({ bundle, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>
            Bundle #{bundle.bundle_number}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            {bundle.subject?.subject_code} — {bundle.subject?.subject_name}
          </p>
        </div>
        <StatusBadge status={bundle.status} />
      </div>
      <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#64748b' }}>
        <span>📄 {bundle.total_sheets} sheets</span>
        <span>🏫 {bundle.subject?.department}</span>
        <span>📅 Sem {bundle.subject?.semester}</span>
      </div>
    </div>
  );
}
