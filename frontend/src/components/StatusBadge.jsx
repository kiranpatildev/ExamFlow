const STATUS_MAP = {
  open:             { label: 'Open',             color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  submitted:        { label: 'Submitted',         color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  pending:          { label: 'Pending',           color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  assigned:         { label: 'Assigned',          color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  under_evaluation: { label: 'Under Evaluation',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  completed:        { label: 'Completed',         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      color: cfg.color,
      background: cfg.bg,
      letterSpacing: '0.02em',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: cfg.color, display: 'inline-block',
      }} />
      {cfg.label}
    </span>
  );
}
