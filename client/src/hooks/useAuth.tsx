'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';

interface User {
    id: string;
    email: string;
    username: string;
    avatar: string | null;
    createdAt: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('codesync_token');
        if (savedToken) {
            setToken(savedToken);
            api.auth.me(savedToken)
                .then((data) => setUser(data.user))
                .catch(() => {
                    localStorage.removeItem('codesync_token');
                    setToken(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const data = await api.auth.login({ email, password });
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('codesync_token', data.token);
    }, []);

    const signup = useCallback(async (email: string, username: string, password: string) => {
        const data = await api.auth.signup({ email, username, password });
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('codesync_token', data.token);
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('codesync_token');
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
