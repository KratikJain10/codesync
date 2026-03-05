'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Application error:', error);
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            textAlign: 'center',
            padding: 20,
        }}>
            <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24
            }}>
                <AlertTriangle size={28} style={{ color: '#ef4444' }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                Something went wrong
            </h1>
            <p style={{
                color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8, maxWidth: 400
            }}>
                An unexpected error occurred. Our team has been notified.
            </p>
            {error.digest && (
                <p style={{
                    color: 'var(--text-muted)', fontSize: 12, marginBottom: 24,
                    fontFamily: 'var(--font-mono)',
                }}>
                    Error ID: {error.digest}
                </p>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
                <button
                    className="btn btn-primary"
                    onClick={reset}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} /> Try Again
                </button>
                <Link
                    href="/"
                    className="btn btn-secondary"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <Home size={14} /> Go Home
                </Link>
            </div>
        </div>
    );
}
