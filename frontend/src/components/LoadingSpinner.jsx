export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = { sm: '16px', md: '28px', lg: '48px' };
  const dim = sizes[size] || sizes.md;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div
        style={{
          width: dim,
          height: dim,
          border: '3px solid rgba(99,102,241,0.2)',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      {text && <span style={{ color: '#94a3b8', fontSize: '14px' }}>{text}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
