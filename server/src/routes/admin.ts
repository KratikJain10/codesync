import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/admin/stats — Aggregate platform stats
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const [
            totalUsers,
            totalRooms,
            totalFiles,
            totalMessages,
            recentActivities,
            roomsByLanguage,
            usersThisWeek,
            roomsThisWeek,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.room.count(),
            prisma.file.count(),
            prisma.message.count(),
            prisma.activity.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
                include: {
                    user: { select: { username: true, avatar: true } },
                    room: { select: { name: true, slug: true } },
                },
            }),
            prisma.room.groupBy({
                by: ['language'],
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            }),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.room.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        res.json({
            stats: {
                totalUsers,
                totalRooms,
                totalFiles,
                totalMessages,
                usersThisWeek,
                roomsThisWeek,
            },
            recentActivities,
            roomsByLanguage: roomsByLanguage.map((r: any) => ({
                language: r.language,
                count: r._count.id,
            })),
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/admin/activities/:roomSlug — Room activity feed
router.get('/activities/:roomSlug', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const room = await prisma.room.findUnique({
            where: { slug: req.params.roomSlug as string },
        });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        const activities = await prisma.activity.findMany({
            where: { roomId: room.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                user: { select: { username: true, avatar: true } },
            },
        });

        res.json({ activities });
    } catch (error) {
        console.error('Room activities error:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

export default router;
