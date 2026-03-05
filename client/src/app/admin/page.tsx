'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import {
    Zap, ArrowLeft, Users, FolderOpen, FileText,
    MessageSquare, TrendingUp, Activity, Globe, BarChart3,
} from 'lucide-react';

interface Stats {
    totalUsers: number;
    totalRooms: number;
    totalFiles: number;
    totalMessages: number;
    usersThisWeek: number;
    roomsThisWeek: number;
}

interface LanguageStat {
    language: string;
    count: number;
}

interface ActivityItem {
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
    user: { username: string; avatar: string | null };
    room: { name: string; slug: string };
}

export default function AdminPage() {
    const router = useRouter();
    const { user, token, loading: authLoading } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [languages, setLanguages] = useState<LanguageStat[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return; // Wait for auth to resolve
        if (!token) {
            router.push('/login');
            return;
        }
        fetchStats();
    }, [token, authLoading, router]);

    async function fetchStats() {
        if (!token) return;
        try {
            const data = await api.admin.stats(token);
            setStats(data.stats);
            setLanguages(data.roomsByLanguage || []);
            setActivities(data.recentActivities || []);
        } catch (err) {
            console.error('Failed to load stats:', err);
        } finally {
            setLoading(false);
        }
    }

    const actionLabels: Record<string, string> = {
        file_created: 'Created a file',
        file_edited: 'Edited a file',
        member_joined: 'Joined room',
        room_forked: 'Forked room',
        code_executed: 'Ran code',
    };

    function getTimeAgo(date: string): string {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    if (loading) {
        return (
            <div className="auth-page">
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading analytics...</p>
                </div>
            </div>
        );
    }

    const maxLangCount = Math.max(...languages.map(l => l.count), 1);

    return (
        <div className="auth-page">
            <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                    <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}>
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <Link href="/" className="auth-logo" style={{ textDecoration: 'none' }}>
                        <Zap size={20} /> CodeSync
                    </Link>
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <BarChart3 size={24} /> Analytics Dashboard
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>
                    Platform-wide usage statistics and activity feed
                </p>

                {stats && (
                    <>
                        {/* Stat Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 32 }}>
                            {[
                                { icon: <Users size={20} />, label: 'Total Users', value: stats.totalUsers, color: '#8b5cf6' },
                                { icon: <FolderOpen size={20} />, label: 'Total Rooms', value: stats.totalRooms, color: '#3b82f6' },
                                { icon: <FileText size={20} />, label: 'Total Files', value: stats.totalFiles, color: '#22c55e' },
                                { icon: <MessageSquare size={20} />, label: 'Messages', value: stats.totalMessages, color: '#f59e0b' },
                                { icon: <TrendingUp size={20} />, label: 'Users (7d)', value: stats.usersThisWeek, color: '#ec4899' },
                                { icon: <TrendingUp size={20} />, label: 'Rooms (7d)', value: stats.roomsThisWeek, color: '#06b6d4' },
                            ].map((card) => (
                                <div key={card.label} className="card" style={{
                                    padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
                                    borderLeft: `3px solid ${card.color}`
                                }}>
                                    <div style={{ color: card.color }}>{card.icon}</div>
                                    <div style={{ fontSize: 28, fontWeight: 800 }}>{card.value}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Two Columns: Language Distribution + Activity Feed */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            {/* Language Distribution */}
                            <div className="card" style={{ padding: 24 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Globe size={16} /> Rooms by Language
                                </h3>
                                {languages.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {languages.map((lang) => (
                                            <div key={lang.language}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                                    <span style={{ textTransform: 'capitalize' }}>{lang.language}</span>
                                                    <span style={{ color: 'var(--text-muted)' }}>{lang.count}</span>
                                                </div>
                                                <div style={{
                                                    height: 6, background: 'var(--bg-glass-light)', borderRadius: 3, overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        height: '100%', borderRadius: 3,
                                                        width: `${(lang.count / maxLangCount) * 100}%`,
                                                        background: 'linear-gradient(90deg, var(--accent), #a855f7)',
                                                        transition: 'width 0.5s ease',
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet</p>
                                )}
                            </div>

                            {/* Activity Feed */}
                            <div className="card" style={{ padding: 24, maxHeight: 400, overflow: 'auto' }}>
                                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Activity size={16} /> Recent Activity
                                </h3>
                                {activities.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {activities.map((act) => (
                                            <div key={act.id} style={{
                                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                                paddingBottom: 12, borderBottom: '1px solid var(--border)'
                                            }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0
                                                }}>
                                                    {act.user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13 }}>
                                                        <strong>{act.user.username}</strong>{' '}
                                                        <span style={{ color: 'var(--text-secondary)' }}>
                                                            {actionLabels[act.action] || act.action}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                        in <strong>{act.room.name}</strong> · {getTimeAgo(act.createdAt)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activity recorded yet</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
