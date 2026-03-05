import { Router, Request, Response } from 'express';
import { loginWithGitHub } from '../services/auth.service';

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.SERVER_PORT || 4000}`;
const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
};

// GET /api/auth/github — Redirect to GitHub OAuth
router.get('/github', (_req: Request, res: Response): void => {
    if (!GITHUB_CLIENT_ID) {
        res.status(501).json({ error: 'GitHub OAuth not configured' });
        return;
    }
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        scope: 'read:user user:email',
        redirect_uri: `${SERVER_URL}/api/auth/github/callback`,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/github/callback — Handle OAuth callback
router.get('/github/callback', async (req: Request, res: Response): Promise<void> => {
    try {
        const { code } = req.query;
        if (!code || typeof code !== 'string') {
            res.redirect(`${CLIENT_URL}/login?error=no_code`);
            return;
        }

        // Exchange code for access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
            }),
        });
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

        if (!tokenData.access_token) {
            res.redirect(`${CLIENT_URL}/login?error=token_failed`);
            return;
        }

        // Fetch GitHub user profile
        const userRes = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const ghUser = await userRes.json() as {
            id: number;
            login: string;
            email: string | null;
            avatar_url: string | null;
        };

        // Fetch email if not public
        let email = ghUser.email;
        if (!email) {
            const emailsRes = await fetch('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const emails = await emailsRes.json() as { email: string; primary: boolean }[];
            email = emails.find(e => e.primary)?.email || null;
        }

        // Login or create user
        const result = await loginWithGitHub(
            {
                id: String(ghUser.id),
                username: ghUser.login,
                email,
                avatar: ghUser.avatar_url,
            },
            { userAgent: req.headers['user-agent'], ip: req.ip }
        );

        // Set httpOnly cookie
        res.cookie('token', result.token, COOKIE_OPTS);

        // Redirect to dashboard with token in URL hash (for client to grab)
        res.redirect(`${CLIENT_URL}/dashboard?token=${result.token}`);
    } catch (error) {
        console.error('GitHub OAuth error:', error);
        res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
    }
});

export default router;
