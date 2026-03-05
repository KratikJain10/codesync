import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    userId?: string;
    userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

/**
 * Auth middleware — reads JWT from:
 * 1. Authorization: Bearer <token> header (API clients, mobile)
 * 2. httpOnly cookie named 'token' (browser, more secure)
 * Both paths are supported for backward compatibility.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
    // Try header first, then cookie
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            userId: string;
            email?: string;
        };
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
