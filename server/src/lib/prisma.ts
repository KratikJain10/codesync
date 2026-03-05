import { PrismaClient } from '@prisma/client';

// Singleton pattern: reuse one PrismaClient across the entire server.
// Prevents connection pool exhaustion under load.
// In dev, attach to global to survive HMR reloads.

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
