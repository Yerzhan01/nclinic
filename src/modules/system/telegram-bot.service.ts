
import { Telegraf, Context } from 'telegraf';
import { logger } from '@/common/utils/logger.js';
import { prisma } from '@/config/prisma.js';
import { redis } from '@/config/redis.js';
import { systemLogService } from './system-log.service.js';

export class TelegramBotService {
    private bot!: Telegraf;
    private initialized = false;
    private adminChatId: string | null = null;

    constructor() {
        const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN;
        if (!token) {
            logger.warn('TELEGRAM_ADMIN_BOT_TOKEN not found, bot disabled');
            return;
        }

        this.bot = new Telegraf(token);
        this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || null;
    }

    async initialize() {
        if (!this.bot) return;

        // Middleware to enforce Admin Access
        this.bot.use(async (ctx, next) => {
            if (!ctx.from || !ctx.chat) return;

            const userId = String(ctx.from.id);

            // If ID matches env, or env is empty (first setup)
            if (this.adminChatId && userId !== this.adminChatId) {
                logger.warn({ userId }, 'Unauthorized access attempt to Telegram Bot');
                // Optional: Silent ignore or reply "Access Denied"
                return ctx.reply('⛔ Access Denied');
            }

            return next();
        });

        // /start
        this.bot.command('start', (ctx) => {
            const userId = String(ctx.from.id);
            if (!this.adminChatId) {
                logger.info({ userId }, 'Admin Chat ID candidate detected');
                return ctx.reply(`👋 Привет! \n\nТвой Chat ID: \`${userId}\`\n\nПожалуйста, добавь его в файл .env:\n\`TELEGRAM_ADMIN_CHAT_ID=${userId}\`\n\nЗатем перезагрузи сервер.`);
            }
            return ctx.reply('✅ Админ-бот онлайн. \n\nКоманды:\n/status - Статус системы\n/logs - Логи событий\n/restart - Перезагрузка сервера');
        });

        // /status
        this.bot.command('status', async (ctx) => {
            try {
                const dbStart = Date.now();
                await prisma.$queryRaw`SELECT 1`;
                const dbLatency = Date.now() - dbStart;

                const redisStart = Date.now();
                await redis.ping();
                const redisLatency = Date.now() - redisStart;

                const uptime = process.uptime();
                const h = Math.floor(uptime / 3600);
                const m = Math.floor((uptime % 3600) / 60);
                const s = Math.floor(uptime % 60);
                const uptimeString = `${h}ч ${m}м ${s}с`;

                ctx.reply(
                    `📊 *Статус Системы*\n\n` +
                    `🏥 Статус: *ONLINE*\n` +
                    `🗄️ База данных: *OK* (${dbLatency}ms)\n` +
                    `🚀 Redis: *OK* (${redisLatency}ms)\n` +
                    `⏱️ Аптайм: ${uptimeString}\n` +
                    `📅 Время сервера: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                ctx.reply(`❌ *Критическая ошибка*\n\n${(error as Error).message}`, { parse_mode: 'Markdown' });
            }
        });

        // /logs - Last 5 ERROR/WARN
        this.bot.command('logs', async (ctx) => {
            try {
                const logs = await systemLogService.list({ limit: 5 });

                if (logs.length === 0) {
                    return ctx.reply('📭 Логов пока нет.');
                }

                const msg = logs.map(l => {
                    const icon = l.level === 'ERROR' ? '🔴' : l.level === 'WARN' ? '⚠️' : 'ℹ️';
                    const time = new Date(l.createdAt).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Almaty' });
                    return `${icon} *${time}* [${l.category}]\n${l.message}`;
                }).join('\n\n');

                ctx.reply(msg, { parse_mode: 'Markdown' });
            } catch (error) {
                ctx.reply('❌ Не удалось получить логи');
            }
        });

        // /restart
        this.bot.command('restart', (ctx) => {
            ctx.reply('♻️ Перезагрузка системы... Подожди 30 секунд.').then(() => {
                logger.warn('Restart triggered via Telegram');
                process.exit(1); // Docker will restart
            });
        });

        // Error handling
        this.bot.catch((err) => {
            logger.error({ err }, 'Telegram Bot Error');
        });

        // Launch
        await this.bot.launch(() => {
            this.initialized = true;
            logger.info('Telegram Bot started');
        });

        // Graceful stop
        process.once('SIGINT', () => this.bot && this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot && this.bot.stop('SIGTERM'));
    }

    async notify(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
        if (!this.bot || !this.adminChatId) return;

        const icon = level === 'ERROR' ? '🚨' : level === 'WARN' ? '⚠️' : 'ℹ️';
        try {
            await this.bot.telegram.sendMessage(this.adminChatId, `${icon} ${message}`);
        } catch (error) {
            logger.error({ error }, 'Failed to send Telegram notification');
        }
    }
}

export const telegramBotService = new TelegramBotService();
