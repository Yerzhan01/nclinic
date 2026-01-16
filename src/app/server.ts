import Fastify, { type FastifyInstance } from 'fastify';
import { loggerConfig } from '@/common/utils/logger.js';

export function createServer(): FastifyInstance {
    const app = Fastify({
        logger: loggerConfig,
        trustProxy: true,
        disableRequestLogging: false,
        requestIdHeader: 'x-request-id',
        requestIdLogLabel: 'reqId',
    });

    return app;
}
