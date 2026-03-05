import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate, signupSchema, loginSchema, changePasswordSchema } from '../middleware/validate';

const router = Router();

// POST /api/auth/signup
router.post('/signup', validate(signupSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            res.status(400).json({ error: 'Email, username, and password are required' });
            return;
        }

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });

        if (existingUser) {
            res.status(409).json({ error: 'Email or username already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { email, username, password: hashedPassword },
            select: { id: true, email: true, username: true, avatar: true, createdAt: true },
        });

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '7d' } as jwt.SignOptions
        );

        res.status(201).json({ user, token });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '7d' } as jwt.SignOptions
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                avatar: user.avatar,
                createdAt: user.createdAt,
            },
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { id: true, email: true, username: true, avatar: true, createdAt: true },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({ user });
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/auth/profile — Update profile
router.patch('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { username, avatar } = req.body;
        const data: any = {};
        if (username) data.username = username;
        if (avatar !== undefined) data.avatar = avatar;

        if (username) {
            const existing = await prisma.user.findFirst({
                where: { username, NOT: { id: req.userId } },
            });
            if (existing) {
                res.status(409).json({ error: 'Username already taken' });
                return;
            }
        }

        const user = await prisma.user.update({
            where: { id: req.userId },
            data,
            select: { id: true, email: true, username: true, avatar: true, createdAt: true },
        });

        res.json({ user });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, validate(changePasswordSchema), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Current and new passwords are required' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ error: 'New password must be at least 6 characters' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            res.status(401).json({ error: 'Current password is incorrect' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: req.userId },
            data: { password: hashedPassword },
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
// GET /api/auth/activity — Get user activity heatmap data
router.get('/activity', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const since = new Date();
        since.setDate(since.getDate() - 182); // ~26 weeks

        const [activities, messages] = await Promise.all([
            prisma.activity.findMany({
                where: { userId: req.userId!, createdAt: { gte: since } },
                select: { createdAt: true },
            }),
            prisma.message.findMany({
                where: { userId: req.userId!, createdAt: { gte: since } },
                select: { createdAt: true },
            }),
        ]);

        // Aggregate by date
        const counts: Record<string, number> = {};
        [...activities, ...messages].forEach(item => {
            const date = item.createdAt.toISOString().split('T')[0];
            counts[date] = (counts[date] || 0) + 1;
        });

        res.json({ activity: counts });
    } catch (error) {
        console.error('Activity error:', error);
        res.status(500).json({ error: 'Failed to get activity' });
    }
});

export default router;
