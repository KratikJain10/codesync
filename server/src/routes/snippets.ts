import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/snippets — List user's snippets
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const snippets = await prisma.snippet.findMany({
            where: { userId: req.userId! },
            orderBy: { updatedAt: 'desc' },
        });
        res.json({ snippets });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch snippets' });
    }
});

// POST /api/snippets — Create snippet
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { title, code, language, tags } = req.body;
        if (!title || !code) {
            res.status(400).json({ error: 'Title and code are required' });
            return;
        }
        const snippet = await prisma.snippet.create({
            data: {
                title,
                code,
                language: language || 'javascript',
                tags: tags || '',
                userId: req.userId!,
            },
        });
        res.status(201).json({ snippet });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create snippet' });
    }
});

// PATCH /api/snippets/:id — Update snippet
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const snippet = await prisma.snippet.findFirst({
            where: { id: req.params.id as string, userId: req.userId! },
        });
        if (!snippet) {
            res.status(404).json({ error: 'Snippet not found' });
            return;
        }
        const updated = await prisma.snippet.update({
            where: { id: req.params.id as string },
            data: req.body,
        });
        res.json({ snippet: updated });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update snippet' });
    }
});

// DELETE /api/snippets/:id — Delete snippet
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const snippet = await prisma.snippet.findFirst({
            where: { id: req.params.id as string, userId: req.userId! },
        });
        if (!snippet) {
            res.status(404).json({ error: 'Snippet not found' });
            return;
        }
        await prisma.snippet.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete snippet' });
    }
});

export default router;
