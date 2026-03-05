import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import RedisStore from 'rate-limit-redis';
import { setupYjsServer } from './yjs/ws-server';
import { setupSocketHandlers } from './socket';
import authRoutes from './routes/auth';
import githubAuthRoutes from './routes/github-auth';
import roomRoutes from './routes/rooms';
import executionRoutes from './routes/execution';
import exportRoutes from './routes/export';
import versionRoutes from './routes/versions';
import adminRoutes from './routes/admin';
import snippetRoutes from './routes/snippets';
import commentRoutes from './routes/comments';
import formatRoutes from './routes/format';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new SocketIOServer(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Redis adapter for horizontal scaling (optional — graceful fallback)
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
    const pubClient = new Redis(REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('📡 Socket.io Redis adapter connected');
}

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate limiters — Redis-backed when available, in-memory fallback
const redisRLClient = REDIS_URL ? new Redis(REDIS_URL) : null;
const storeOpts: any = redisRLClient ? { store: new RedisStore({ sendCommand: (...args: string[]) => (redisRLClient as any).call(...args) }) } : {};
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, ...storeOpts });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, message: { error: 'Too many requests, please try again later' }, ...storeOpts });
const executionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, message: { error: 'Execution rate limit exceeded' }, ...storeOpts });

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', authLimiter, githubAuthRoutes);
app.use('/api/rooms', generalLimiter, roomRoutes);
app.use('/api/rooms', exportRoutes);
app.use('/api/rooms', versionRoutes);
app.use('/api/execute', executionLimiter, executionRoutes);
app.use('/api/admin', generalLimiter, adminRoutes);
app.use('/api/snippets', generalLimiter, snippetRoutes);
app.use('/api/rooms', commentRoutes);
app.use('/api/format', generalLimiter, formatRoutes);

// Socket.io handlers (chat, presence)
setupSocketHandlers(io);

// Yjs WebSocket server (CRDT sync on /yjs path)
setupYjsServer(server);

const PORT = parseInt(process.env.SERVER_PORT || '4000', 10);

server.listen(PORT, () => {
    console.log(`\n🚀 CodeSync server running on http://localhost:${PORT}`);
    console.log(`📡 Yjs WebSocket server on ws://localhost:${PORT}/yjs`);
    console.log(`💬 Socket.io server on ws://localhost:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
});

export { io, app };
