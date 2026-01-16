import { PrismaClient } from '@prisma/client';
import { isDev } from './env.js';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: isDev ? ['query', 'info', 'warn', 'error'] : ['error'],
    });

if (isDev) {
    globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        console.log('✅ Database connected');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
}

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
    console.log('📤 Database disconnected');
}
