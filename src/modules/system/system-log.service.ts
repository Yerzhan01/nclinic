
import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';

export type SystemLogLevel = 'INFO' | 'WARN' | 'ERROR';
export type SystemLogCategory = 'SCHEDULER' | 'AI' | 'SYSTEM' | 'MESSAGE' | 'INTEGRATION';

export class SystemLogService {
    async create(level: SystemLogLevel, category: SystemLogCategory, message: string, meta?: any) {
        try {
            await prisma.systemLog.create({
                data: {
                    level,
                    category,
                    message,
                    meta: meta || {}
                }
            });

            if (level === 'ERROR' || level === 'WARN') {
                await import('./telegram-bot.service.js').then(({ telegramBotService }) => {
                    telegramBotService.notify(`[${category}] ${message}`, level);
                }).catch(() => { }); // Prevent circular dependency crash or init issues
            }
        } catch (error) {
            // Fallback to console if DB write fails (e.g. connection lost)
            logger.error({ error, originalMessage: message }, 'Failed to write SystemLog');
        }
    }

    async list(params: {
        limit?: number;
        category?: string;
        level?: string;
    }) {
        const { limit = 50, category, level } = params;

        return prisma.systemLog.findMany({
            where: {
                ...(category ? { category } : {}),
                ...(level ? { level } : {})
            },
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        });
    }

    async cleanupOldLogs(days = 7) {
        const date = new Date();
        date.setDate(date.getDate() - days);

        await prisma.systemLog.deleteMany({
            where: {
                createdAt: { lt: date }
            }
        });
    }
}

export const systemLogService = new SystemLogService();
