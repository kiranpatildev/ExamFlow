const STATUS_CONFIG = {
  pending:          { label: 'Pending',         cls: 'badge badge-warning' },
  open:             { label: 'Open',            cls: 'badge badge-info' },
  submitted:        { label: 'Submitted',       cls: 'badge badge-indigo' },
  assigned:         { label: 'Assigned',        cls: 'badge badge-info' },
  under_evaluation: { label: 'Under Evaluation',cls: 'badge badge-warning' },
  completed:        { label: 'Completed',       cls: 'badge badge-success' },
  finalized:        { label: 'Finalized',       cls: 'badge badge-success' },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'Unknown', cls: 'badge badge-neutral' };
  return <span className={cfg.cls}>{cfg.label}</span>;
}
