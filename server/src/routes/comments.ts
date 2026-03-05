import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/rooms/:slug/files/:fileId/comments — List comments for a file
router.get('/:slug/files/:fileId/comments', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const comments = await prisma.codeComment.findMany({
            where: { fileId: req.params.fileId as string },
            orderBy: { line: 'asc' },
            include: {
                user: { select: { username: true, avatar: true } },
            },
        });
        res.json({ comments });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// POST /api/rooms/:slug/files/:fileId/comments — Add comment
router.post('/:slug/files/:fileId/comments', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { content, line } = req.body;
        if (!content || line === undefined) {
            res.status(400).json({ error: 'Content and line number are required' });
            return;
        }
        const comment = await prisma.codeComment.create({
            data: {
                content,
                line,
                userId: req.userId!,
                fileId: req.params.fileId as string,
            },
            include: {
                user: { select: { username: true, avatar: true } },
            },
        });
        res.status(201).json({ comment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// PATCH /api/rooms/:slug/files/:fileId/comments/:commentId/resolve — Toggle resolved
router.patch('/:slug/files/:fileId/comments/:commentId/resolve', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const comment = await prisma.codeComment.findUnique({
            where: { id: req.params.commentId as string },
        });
        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }
        const updated = await prisma.codeComment.update({
            where: { id: req.params.commentId as string },
            data: { resolved: !comment.resolved },
        });
        res.json({ comment: updated });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resolve comment' });
    }
});

// DELETE /api/rooms/:slug/files/:fileId/comments/:commentId — Delete comment
router.delete('/:slug/files/:fileId/comments/:commentId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const comment = await prisma.codeComment.findFirst({
            where: { id: req.params.commentId as string, userId: req.userId! },
        });
        if (!comment) {
            res.status(404).json({ error: 'Comment not found or unauthorized' });
            return;
        }
        await prisma.codeComment.delete({ where: { id: req.params.commentId as string } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

export default router;
