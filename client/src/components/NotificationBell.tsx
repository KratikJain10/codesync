'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, X, Check, CheckCheck, Info, UserPlus, FileText, GitFork, Zap } from 'lucide-react';

interface Notification {
    id: string;
    type: 'info' | 'success' | 'join' | 'file' | 'fork';
    message: string;
    timestamp: Date;
    read: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
    info: <Info size={14} />,
    success: <Zap size={14} />,
    join: <UserPlus size={14} />,
    file: <FileText size={14} />,
    fork: <GitFork size={14} />,
};

const colorMap: Record<string, string> = {
    info: '#3b82f6',
    success: '#22c55e',
    join: '#8b5cf6',
    file: '#f59e0b',
    fork: '#06b6d4',
};

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((type: Notification['type'], message: string) => {
        const notif: Notification = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            type,
            message,
            timestamp: new Date(),
            read: false,
        };
        setNotifications(prev => [notif, ...prev].slice(0, 50));
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return { notifications, addNotification, markAllRead, clearAll, unreadCount };
}

interface NotificationBellProps {
    notifications: Notification[];
    unreadCount: number;
    onMarkAllRead: () => void;
    onClearAll: () => void;
}

export default function NotificationBell({ notifications, unreadCount, onMarkAllRead, onClearAll }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    function timeAgo(date: Date): string {
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'now';
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    }

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                className="btn btn-secondary btn-icon"
                style={{ position: 'relative', padding: '6px 8px' }}
                onClick={() => { setIsOpen(!isOpen); if (!isOpen) onMarkAllRead(); }}
                title="Notifications"
            >
                <Bell size={16} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -4, right: -4,
                        background: '#ef4444', color: 'white', fontSize: 9,
                        fontWeight: 700, minWidth: 16, height: 16,
                        borderRadius: 8, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: '0 4px',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 8,
                    width: 320, maxHeight: 400, overflowY: 'auto',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 100,
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {notifications.length > 0 && (
                                <>
                                    <button
                                        onClick={onMarkAllRead}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                                        title="Mark all read"
                                    >
                                        <CheckCheck size={14} />
                                    </button>
                                    <button
                                        onClick={onClearAll}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                                        title="Clear all"
                                    >
                                        <X size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {notifications.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            No notifications yet
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div key={n.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                                background: n.read ? 'transparent' : 'rgba(108, 92, 231, 0.04)',
                            }}>
                                <div style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    background: `${colorMap[n.type]}20`, color: colorMap[n.type],
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, marginTop: 2,
                                }}>
                                    {iconMap[n.type]}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>{n.message}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {timeAgo(n.timestamp)}
                                    </div>
                                </div>
                                {!n.read && (
                                    <div style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: 'var(--accent-primary)', flexShrink: 0, marginTop: 6,
                                    }} />
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
