import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/rooms/:slug/files/:fileId/versions — List versions
router.get('/:slug/files/:fileId/versions', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const versions = await prisma.fileVersion.findMany({
            where: { fileId: req.params.fileId as string },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                label: true,
                createdAt: true,
                content: false, // Don't send content in list
            },
        });
        res.json({ versions });
    } catch (error) {
        console.error('List versions error:', error);
        res.status(500).json({ error: 'Failed to list versions' });
    }
});

// GET /api/rooms/:slug/files/:fileId/versions/:versionId — Get version content
router.get('/:slug/files/:fileId/versions/:versionId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const version = await prisma.fileVersion.findUnique({
            where: { id: req.params.versionId as string },
        });
        if (!version) {
            res.status(404).json({ error: 'Version not found' });
            return;
        }
        res.json({ version });
    } catch (error) {
        console.error('Get version error:', error);
        res.status(500).json({ error: 'Failed to get version' });
    }
});

// POST /api/rooms/:slug/files/:fileId/versions/:versionId/restore — Restore version
router.post('/:slug/files/:fileId/versions/:versionId/restore', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const version = await prisma.fileVersion.findUnique({
            where: { id: req.params.versionId as string },
        });
        if (!version) {
            res.status(404).json({ error: 'Version not found' });
            return;
        }

        // Save current content as a version before restoring
        const currentFile = await prisma.file.findUnique({ where: { id: req.params.fileId as string } });
        if (currentFile) {
            await prisma.fileVersion.create({
                data: {
                    fileId: currentFile.id,
                    content: currentFile.content,
                    label: 'Before restore',
                },
            });
        }

        // Restore the file content
        const updatedFile = await prisma.file.update({
            where: { id: req.params.fileId as string },
            data: { content: version.content },
        });

        res.json({ file: updatedFile });
    } catch (error) {
        console.error('Restore version error:', error);
        res.status(500).json({ error: 'Failed to restore version' });
    }
});

export default router;
