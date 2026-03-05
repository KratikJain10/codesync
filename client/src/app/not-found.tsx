import Link from 'next/link';

export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            padding: 20,
        }}>
            <div style={{
                fontSize: 120,
                fontWeight: 800,
                lineHeight: 1,
                background: 'linear-gradient(135deg, var(--accent) 0%, #a855f7 50%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: 16,
            }}>
                404
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
                Page not found
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 32, maxWidth: 400 }}>
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
                <Link
                    href="/"
                    className="btn btn-primary"
                    style={{ textDecoration: 'none', padding: '10px 24px' }}
                >
                    Go Home
                </Link>
                <Link
                    href="/dashboard"
                    className="btn btn-secondary"
                    style={{ textDecoration: 'none', padding: '10px 24px' }}
                >
                    Dashboard
                </Link>
            </div>
            <div style={{
                marginTop: 60,
                padding: '16px 24px',
                background: 'var(--bg-glass-light)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
            }}>
                <span style={{ color: 'var(--accent)' }}>$</span> curl -I {typeof window !== 'undefined' ? window.location.href : 'this-page'}
                <br />
                <span style={{ color: '#ef4444' }}>HTTP/1.1 404 Not Found</span>
            </div>
        </div>
    );
}
