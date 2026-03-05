import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import archiver from 'archiver';
import jwt from 'jsonwebtoken';

const router = Router();

// GET /api/rooms/:slug/export — Download room as ZIP
// Uses query param token since browser downloads can't set Authorization header
router.get('/:slug/export', async (req: Request, res: Response): Promise<void> => {
    try {
        // Auth via query param
        const token = req.query.token as string;
        if (!token) {
            res.status(401).json({ error: 'Token required' });
            return;
        }
        try {
            jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        } catch {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        const slugParam = req.params.slug as string;

        const room = await prisma.room.findUnique({
            where: { slug: slugParam },
            include: { files: true },
        });

        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        // Set headers for ZIP download
        const safeName = room.name.replace(/[^a-zA-Z0-9-_]/g, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

        // Create ZIP archive
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            res.status(500).end();
        });

        // Pipe archive to response
        archive.pipe(res);

        // Add each file to the archive
        for (const file of room.files) {
            archive.append(file.content || '', { name: file.name });
        }

        await archive.finalize();
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export room' });
    }
});

export default router;
