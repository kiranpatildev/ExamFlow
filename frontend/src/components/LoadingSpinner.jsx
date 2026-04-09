export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = { sm: 16, md: 24, lg: 36 };
  const px = sizes[size] || 24;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <svg
        width={px} height={px}
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: 'spin 0.75s linear infinite' }}
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <circle cx="12" cy="12" r="10" stroke="#e2e8f0" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#1a202c" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {text && <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{text}</span>}
    </span>
  );
}
