'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import {
    Zap, Link2, Search, Trash2, FileText, Users,
    Clock, FolderOpen, Plus, Loader2, Sparkles, Keyboard, Settings, BarChart3, Sun, Moon, Activity
} from 'lucide-react';

interface Room {
    id: string;
    name: string;
    slug: string;
    language: string;
    isPublic: boolean;
    createdAt: string;
    _count?: { files: number; members: number };
    files?: { id: string }[];
    members?: { user: { id: string; username: string } }[];
}

interface Template {
    id: string;
    name: string;
    icon: string;
    description: string;
    language: string;
    files: { name: string; content: string; language: string }[];
}

function ActivityHeatmap({ token }: { token: string | null }) {
    const [data, setData] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!token) return;
        api.auth.activity(token).then(res => setData(res.activity || {})).catch(() => { });
    }, [token]);

    // Generate 26 weeks of dates
    const weeks: string[][] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 182);
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let current = new Date(startDate);
    while (current <= today) {
        const week: string[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        weeks.push(week);
    }

    const getColor = (count: number) => {
        if (count === 0) return 'var(--bg-glass-light)';
        if (count <= 2) return 'rgba(108, 92, 231, 0.25)';
        if (count <= 5) return 'rgba(108, 92, 231, 0.5)';
        if (count <= 10) return 'rgba(108, 92, 231, 0.75)';
        return 'var(--accent)';
    };

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '20px 24px', marginBottom: 24
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Activity size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Activity</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {Object.values(data).reduce((a, b) => a + b, 0)} actions in the last 26 weeks
                </span>
            </div>
            <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                    <div style={{ height: 12 }}></div>
                    {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                        <div key={i} style={{ height: 12, lineHeight: '12px' }}>{d}</div>
                    ))}
                </div>
                {weeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ height: 12, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                            {week[0] && new Date(week[0]).getDate() <= 7 ? months[new Date(week[0]).getMonth()] : ''}
                        </div>
                        {week.map(date => {
                            const count = data[date] || 0;
                            return (
                                <div
                                    key={date}
                                    title={`${date}: ${count} action${count !== 1 ? 's' : ''}`}
                                    style={{
                                        width: 12, height: 12, borderRadius: 2,
                                        background: getColor(count),
                                        cursor: 'pointer',
                                        transition: 'transform 0.1s',
                                    }}
                                    onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.3)'; }}
                                    onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                Less
                {[0, 2, 5, 10, 15].map(n => (
                    <div key={n} style={{ width: 10, height: 10, borderRadius: 2, background: getColor(n) }} />
                ))}
                More
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, token, loading: authLoading, logout } = useAuth();
    const { toast } = useToast();
    const { theme, toggleTheme } = useTheme();

    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    // Create room modal
    const [showCreate, setShowCreate] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [creating, setCreating] = useState(false);

    // Join room modal
    const [showJoin, setShowJoin] = useState(false);
    const [joinSlug, setJoinSlug] = useState('');

    // Shortcuts modal
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Grab OAuth token from URL (GitHub redirect)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
            localStorage.setItem('codesync_token', urlToken);
            window.history.replaceState({}, '', '/dashboard');
            window.location.reload();
        }
    }, []);

    useEffect(() => {
        if (authLoading) return; // Wait for auth to resolve
        if (!token) {
            router.push('/login');
            return;
        }
        loadRooms();
        loadTemplates();
    }, [token, authLoading, router]);

    async function loadRooms() {
        try {
            const data = await api.rooms.list(token!);
            setRooms(data.rooms || []);
        } catch {
            toast('Failed to load rooms', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function loadTemplates() {
        try {
            const data = await api.templates.list();
            setTemplates(data.templates || []);
            if (data.templates?.length) {
                setSelectedTemplate(data.templates[0]);
            }
        } catch {
            // Templates are optional, don't show error
        }
    }

    async function createRoom() {
        if (!token) return;
        if (!roomName.trim()) {
            toast('Please enter a room name', 'warning');
            return;
        }
        setCreating(true);
        try {
            const data = await api.rooms.create({
                name: roomName.trim(),
                language: selectedTemplate?.language || 'javascript',
                templateFiles: selectedTemplate?.files,
            }, token);
            toast(`Room "${roomName}" created!`, 'success');
            setShowCreate(false);
            setRoomName('');
            router.push(`/room/${data.room.slug}`);
        } catch (err: any) {
            toast(err.message || 'Failed to create room', 'error');
        } finally {
            setCreating(false);
        }
    }

    function joinRoom() {
        if (!joinSlug.trim()) {
            toast('Please enter a room slug or URL', 'warning');
            return;
        }
        // Extract slug from URL if full URL entered
        let slug = joinSlug.trim();
        if (slug.includes('/room/')) {
            slug = slug.split('/room/').pop() || slug;
        }
        setShowJoin(false);
        setJoinSlug('');
        router.push(`/room/${slug}`);
    }

    async function deleteRoom(slug: string, name: string) {
        if (!token) return;
        try {
            await api.rooms.delete(slug, token);
            setRooms(prev => prev.filter(r => r.slug !== slug));
            setDeleteConfirm(null);
            toast(`Room "${name}" deleted`, 'success');
        } catch (err: any) {
            toast(err.message || 'Failed to delete room', 'error');
        }
    }

    // Keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'n') { e.preventDefault(); setShowCreate(true); }
                if (e.key === 'j') { e.preventDefault(); setShowJoin(true); }
                if (e.key === '/') { e.preventDefault(); setShowShortcuts(true); }
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!user) return null;

    const totalFiles = rooms.reduce((sum, r) => sum + (r.files?.length || r._count?.files || 0), 0);
    const languages = [...new Set(rooms.map(r => r.language))];

    // Search filter
    const filteredRooms = searchQuery.trim()
        ? rooms.filter(r =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.language.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : rooms;

    // Relative time
    function timeAgo(date: string) {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(date).toLocaleDateString();
    }

    return (
        <div className="dashboard">
            {/* Top Nav */}
            <nav className="landing-nav">
                <div className="landing-logo">
                    <div className="landing-logo-icon"><Zap size={18} /></div>
                    CodeSync
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{user.username}</span>
                    <button className="btn btn-secondary btn-icon" title="Toggle theme" style={{ padding: '6px 8px' }} onClick={toggleTheme}>
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <Link href="/admin" className="btn btn-secondary btn-icon" title="Analytics" style={{ textDecoration: 'none', padding: '6px 8px' }}>
                        <BarChart3 size={16} />
                    </Link>
                    <Link href="/settings" className="btn btn-secondary btn-icon" title="Settings" style={{ textDecoration: 'none', padding: '6px 8px' }}>
                        <Settings size={16} />
                    </Link>
                    <button className="btn btn-secondary" onClick={logout}>Logout</button>
                </div>
            </nav>

            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1>Your Rooms</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
                        Create or join a room to start collaborating
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div className="search-bar">
                        <span className="search-bar-icon"><Search size={14} /></span>
                        <input
                            placeholder="Search rooms..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-secondary" onClick={() => setShowJoin(true)}>
                        <Link2 size={14} /> Join Room
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        + New Room
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="dashboard-stats">
                <div className="stat-card">
                    <div className="stat-card-icon"><FolderOpen size={18} /></div>
                    <div className="stat-card-value">{rooms.length}</div>
                    <div className="stat-card-label">Total Rooms</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon"><FileText size={18} /></div>
                    <div className="stat-card-value">{totalFiles}</div>
                    <div className="stat-card-label">Total Files</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon"><Sparkles size={18} /></div>
                    <div className="stat-card-value">{languages.length}</div>
                    <div className="stat-card-label">Languages</div>
                </div>
            </div>

            {/* Activity Heatmap */}
            <ActivityHeatmap token={token} />

            {/* Rooms Grid */}
            <div className="rooms-section">
                <h2>Recent Rooms</h2>
                {loading ? (
                    <div className="rooms-grid">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton skeleton-card" />
                        ))}
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Plus size={48} style={{ opacity: 0.3 }} /></div>
                        <div className="empty-state-text">No rooms yet</div>
                        <div className="empty-state-subtext">Create your first room to start coding</div>
                        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowCreate(true)}>
                            <Plus size={14} /> Create Room
                        </button>
                    </div>
                ) : (
                    <div className="rooms-grid stagger-in">
                        {filteredRooms.map(room => (
                            <div
                                key={room.id}
                                className="room-card"
                                onClick={() => router.push(`/room/${room.slug}`)}
                            >
                                <div className="room-card-header">
                                    <span className="room-card-name">{room.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span className={`lang-dot ${room.language}`} />
                                            <span className="room-card-lang">{room.language}</span>
                                        </span>
                                        <div className="room-card-actions">
                                            <button
                                                className="room-card-action delete"
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(room.slug); }}
                                                title="Delete room"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="room-card-meta">
                                    <span><FileText size={12} /> {room.files?.length || room._count?.files || 0} files</span>
                                    <span><Users size={12} /> {room.members?.length || room._count?.members || 0} members</span>
                                    <span><Clock size={12} /> {timeAgo(room.createdAt)}</span>
                                </div>

                                {/* Delete confirmation inline */}
                                {deleteConfirm === room.slug && (
                                    <div
                                        style={{
                                            marginTop: 12,
                                            padding: '10px 12px',
                                            background: 'rgba(255, 107, 107, 0.1)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid rgba(255, 107, 107, 0.2)',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 8 }}>
                                            Delete this room? This cannot be undone.
                                        </p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => deleteRoom(room.slug, room.name)}>
                                                Delete
                                            </button>
                                            <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setDeleteConfirm(null)}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <h2>Create New Room</h2>

                        {/* Template Picker */}
                        <div style={{ marginTop: 16, marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                Choose a template
                            </label>
                            <div className="template-grid">
                                {templates.map(t => (
                                    <div
                                        key={t.id}
                                        className={`template-card ${selectedTemplate?.id === t.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedTemplate(t)}
                                    >
                                        <div className="template-card-icon">{t.icon}</div>
                                        <div className="template-card-name">{t.name}</div>
                                        <div className="template-card-desc">{t.description}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Room Name */}
                        <div className="input-group">
                            <label>Room Name</label>
                            <input
                                className="input"
                                placeholder="e.g. Algorithm Practice"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                                autoFocus
                            />
                        </div>

                        {selectedTemplate && (
                            <div style={{
                                marginTop: 12,
                                padding: '8px 12px',
                                background: 'var(--bg-glass-light)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                            }}>
                                <FolderOpen size={14} /> {selectedTemplate.files.length} files · {selectedTemplate.language}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={createRoom} disabled={creating}>
                                {creating ? <><Loader2 size={14} className="spinner" /> Creating...</> : <><Sparkles size={14} /> Create Room</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Join Room Modal */}
            {showJoin && (
                <div className="modal-overlay" onClick={() => setShowJoin(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Join a Room</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                            Paste a room URL or slug to join a live session
                        </p>
                        <div className="input-group">
                            <label>Room URL or Slug</label>
                            <input
                                className="input"
                                placeholder="e.g. https://codesync.dev/room/abc-123 or abc-123"
                                value={joinSlug}
                                onChange={(e) => setJoinSlug(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                                autoFocus
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowJoin(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={joinRoom}>Join Room</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shortcuts Modal */}
            {showShortcuts && (
                <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2><Keyboard size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Keyboard Shortcuts</h2>
                        <div className="shortcuts-grid" style={{ marginTop: 16 }}>
                            <div className="shortcut-row">
                                <span className="shortcut-label">New Room</span>
                                <div className="shortcut-keys">
                                    <span className="shortcut-key">Ctrl</span>
                                    <span className="shortcut-key">N</span>
                                </div>
                            </div>
                            <div className="shortcut-row">
                                <span className="shortcut-label">Join Room</span>
                                <div className="shortcut-keys">
                                    <span className="shortcut-key">Ctrl</span>
                                    <span className="shortcut-key">J</span>
                                </div>
                            </div>
                            <div className="shortcut-row">
                                <span className="shortcut-label">Show Shortcuts</span>
                                <div className="shortcut-keys">
                                    <span className="shortcut-key">Ctrl</span>
                                    <span className="shortcut-key">/</span>
                                </div>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                    In Editor
                                </h3>
                            </div>
                            <div className="shortcut-row">
                                <span className="shortcut-label">Save File</span>
                                <div className="shortcut-keys">
                                    <span className="shortcut-key">Ctrl</span>
                                    <span className="shortcut-key">S</span>
                                </div>
                            </div>
                            <div className="shortcut-row">
                                <span className="shortcut-label">Run Code</span>
                                <div className="shortcut-keys">
                                    <span className="shortcut-key">Ctrl</span>
                                    <span className="shortcut-key">Enter</span>
                                </div>
                            </div>
                            <div className="shortcut-row">
                                <span className="shortcut-label">Toggle Sidebar</span>
                                <div className="shortcut-keys">
                                    <span className="shortcut-key">Ctrl</span>
                                    <span className="shortcut-key">B</span>
                                </div>
                            </div>
                            <div className="shortcut-row">
                                <span className="shortcut-label">Toggle Terminal</span>
                                <div className="shortcut-keys">
                                    <span className="shortcut-key">Ctrl</span>
                                    <span className="shortcut-key">`</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowShortcuts(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating shortcuts hint */}
            <div style={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                fontSize: 12,
                color: 'var(--text-muted)',
                cursor: 'pointer',
            }} onClick={() => setShowShortcuts(true)}>
                <span className="shortcut-key" style={{ fontSize: 11 }}>Ctrl</span>
                <span className="shortcut-key" style={{ fontSize: 11 }}>/</span>
                <span style={{ marginLeft: 4 }}>Shortcuts</span>
            </div>
        </div>
    );
}
