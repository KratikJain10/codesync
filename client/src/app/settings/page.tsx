'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
    Zap, User, Mail, Calendar, ArrowLeft, Save, Lock, Eye, EyeOff, LogOut
} from 'lucide-react';

export default function SettingsPage() {
    const router = useRouter();
    const { user, token, loading, logout } = useAuth();
    const { toast } = useToast();

    const [username, setUsername] = useState('');
    const [saving, setSaving] = useState(false);

    // Password
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);

    useEffect(() => {
        if (loading) return; // Wait for auth to resolve
        if (!token) {
            router.push('/login');
            return;
        }
        if (user) {
            setUsername(user.username || '');
        }
    }, [user, token, loading, router]);

    async function saveProfile() {
        if (!token || !username.trim()) return;
        setSaving(true);
        try {
            await api.auth.updateProfile({ username: username.trim() }, token);
            toast('Profile updated!', 'success');
        } catch (err: any) {
            toast(err.message || 'Failed to update profile', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleChangePassword() {
        if (!token) return;
        if (newPassword !== confirmPassword) {
            toast('Passwords do not match', 'error');
            return;
        }
        if (newPassword.length < 6) {
            toast('Password must be at least 6 characters', 'error');
            return;
        }
        setChangingPassword(true);
        try {
            await api.auth.changePassword({ currentPassword, newPassword }, token);
            toast('Password changed successfully!', 'success');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            toast(err.message || 'Failed to change password', 'error');
        } finally {
            setChangingPassword(false);
        }
    }

    function handleLogout() {
        logout();
        router.push('/login');
    }

    if (!user) return null;

    const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    return (
        <div className="auth-page">
            <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                    <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}>
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <Link href="/" className="auth-logo" style={{ textDecoration: 'none' }}>
                        <Zap size={20} /> CodeSync
                    </Link>
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Account Settings</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>
                    Manage your profile and preferences
                </p>

                {/* Profile Card */}
                <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={18} /> Profile
                    </h2>

                    {/* Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%', background: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 24, fontWeight: 700, color: 'white'
                        }}>
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 18 }}>{user.username}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Mail size={12} /> {user.email}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Calendar size={11} /> Member since {memberSince}
                            </div>
                        </div>
                    </div>

                    {/* Username edit */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Username</label>
                        <input
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email</label>
                        <input
                            className="input"
                            value={user.email}
                            disabled
                            style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        />
                    </div>

                    <button className="btn btn-primary" onClick={saveProfile} disabled={saving} style={{ width: '100%' }}>
                        <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                {/* Password Card */}
                <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Lock size={18} /> Change Password
                    </h2>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Current Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input"
                                type={showCurrentPw ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPw(!showCurrentPw)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input"
                                type={showNewPw ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password (min 6 chars)"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPw(!showNewPw)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Confirm New Password</label>
                        <input
                            className="input"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                        />
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handleChangePassword}
                        disabled={changingPassword || !currentPassword || !newPassword}
                        style={{ width: '100%' }}
                    >
                        <Lock size={14} /> {changingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                </div>

                {/* Danger Zone */}
                <div className="card" style={{ padding: 24, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#ef4444' }}>
                        Danger Zone
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                        Signing out will clear your session on this device.
                    </p>
                    <button
                        className="btn btn-secondary"
                        onClick={handleLogout}
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
