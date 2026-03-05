import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ─── Auth Schemas ───────────────────────────────────────────────────────

export const signupSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').max(30).trim(),
    email: z.string().email('Invalid email address').trim().toLowerCase(),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const loginSchema = z.object({
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100),
});

// ─── Room Schemas ───────────────────────────────────────────────────────

export const createRoomSchema = z.object({
    name: z.string().min(1, 'Room name is required').max(100).trim(),
    language: z.string().min(1).max(30).default('javascript'),
    isPublic: z.boolean().optional().default(true),
    password: z.string().max(100).optional(),
    templateFiles: z.array(z.object({
        name: z.string(),
        content: z.string(),
        language: z.string(),
    })).optional(),
});

export const updateRoomSchema = z.object({
    name: z.string().min(1).max(100).trim().optional(),
    isPublic: z.boolean().optional(),
    password: z.string().max(100).nullable().optional(),
});

// ─── File Schemas ───────────────────────────────────────────────────────

const MAX_FILE_SIZE = 500 * 1024; // 500KB

export const createFileSchema = z.object({
    name: z.string().min(1, 'File name is required').max(255).trim(),
    content: z.string().max(MAX_FILE_SIZE, 'File content exceeds 500KB limit').optional().default(''),
    language: z.string().max(30).optional(),
});

export const updateFileSchema = z.object({
    content: z.string().max(MAX_FILE_SIZE, 'File content exceeds 500KB limit').optional(),
    name: z.string().min(1).max(255).trim().optional(),
});

// ─── Comment Schemas ────────────────────────────────────────────────────

export const createCommentSchema = z.object({
    content: z.string().min(1, 'Comment content required').max(2000),
    line: z.number().int().min(1),
});

// ─── Snippet Schemas ────────────────────────────────────────────────────

export const createSnippetSchema = z.object({
    title: z.string().min(1).max(100).trim(),
    code: z.string().min(1).max(MAX_FILE_SIZE),
    language: z.string().max(30).optional().default('plaintext'),
});

// ─── Validation Middleware ──────────────────────────────────────────────

export function validate(schema: z.ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            res.status(400).json({ error: 'Validation failed', details: errors });
            return;
        }
        req.body = result.data;
        next();
    };
}
