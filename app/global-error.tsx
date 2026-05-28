'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', gap: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Something went wrong</h2>
          {error.digest && <p style={{ fontSize: '12px', color: '#64748b' }}>Error ID: {error.digest}</p>}
          <button onClick={reset} style={{ padding: '8px 20px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
