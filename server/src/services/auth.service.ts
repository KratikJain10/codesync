import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRY = '7d';
const SESSION_DAYS = 7;

export interface AuthResult {
    user: { id: string; username: string; email: string; avatar: string | null };
    token: string;
}

// ─── Signup ─────────────────────────────────────────────────────────────

export async function signupUser(
    email: string,
    username: string,
    password: string,
    meta?: { userAgent?: string; ip?: string }
): Promise<AuthResult> {
    const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
    });
    if (existing) {
        throw new Error(existing.email === email ? 'Email already registered' : 'Username already taken');
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { email, username, password: hashed },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    // Create DB session
    await prisma.session.create({
        data: {
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
            userAgent: meta?.userAgent,
            ip: meta?.ip,
        },
    });

    return {
        user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
        token,
    };
}

// ─── Login ──────────────────────────────────────────────────────────────

export async function loginUser(
    email: string,
    password: string,
    meta?: { userAgent?: string; ip?: string }
): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('Invalid credentials');

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    // Create DB session
    await prisma.session.create({
        data: {
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
            userAgent: meta?.userAgent,
            ip: meta?.ip,
        },
    });

    return {
        user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
        token,
    };
}

// ─── GitHub OAuth ───────────────────────────────────────────────────────

export async function loginWithGitHub(
    githubProfile: { id: string; username: string; email: string | null; avatar: string | null },
    meta?: { userAgent?: string; ip?: string }
): Promise<AuthResult> {
    // Find or create user by GitHub ID
    let user = await prisma.user.findUnique({ where: { githubId: githubProfile.id } });

    if (!user) {
        // Check if email is already taken
        if (githubProfile.email) {
            const emailUser = await prisma.user.findUnique({ where: { email: githubProfile.email } });
            if (emailUser) {
                // Link GitHub to existing account
                user = await prisma.user.update({
                    where: { id: emailUser.id },
                    data: { githubId: githubProfile.id, avatar: githubProfile.avatar || emailUser.avatar },
                });
            }
        }

        if (!user) {
            // Create new user — generate random password since they use OAuth
            const randomPass = await bcrypt.hash(Math.random().toString(36), 10);
            user = await prisma.user.create({
                data: {
                    email: githubProfile.email || `${githubProfile.id}@github.local`,
                    username: githubProfile.username,
                    password: randomPass,
                    avatar: githubProfile.avatar,
                    githubId: githubProfile.id,
                },
            });
        }
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    await prisma.session.create({
        data: {
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
            userAgent: meta?.userAgent,
            ip: meta?.ip,
        },
    });

    return {
        user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
        token,
    };
}

// ─── Logout ─────────────────────────────────────────────────────────────

export async function logoutUser(token: string): Promise<void> {
    await prisma.session.deleteMany({ where: { token } });
}

// ─── Validate Session ───────────────────────────────────────────────────

export async function validateSession(token: string): Promise<string | null> {
    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) {
        if (session) await prisma.session.delete({ where: { id: session.id } });
        return null;
    }
    return session.userId;
}

// ─── Change Password ────────────────────────────────────────────────────

export async function changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new Error('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
    });

    // Invalidate all sessions (force re-login)
    await prisma.session.deleteMany({ where: { userId } });
}

// ─── Cleanup Expired Sessions ───────────────────────────────────────────

export async function cleanupExpiredSessions(): Promise<number> {
    const { count } = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
    return count;
}
