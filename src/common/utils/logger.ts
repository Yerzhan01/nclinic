import pino from 'pino';
import { isDev } from '@/config/env.js';

// Logger configuration for Fastify 5 (must be config object, not pino instance)
export const loggerConfig = isDev
    ? {
        level: 'debug',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
            },
        },
    }
    : {
        level: 'info',
    };

// Pino instance for direct use outside Fastify
export const logger = pino(loggerConfig);

export type Logger = typeof logger;
