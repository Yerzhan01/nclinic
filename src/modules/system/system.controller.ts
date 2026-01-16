
import { FastifyRequest, FastifyReply } from 'fastify';
import { systemLogService } from './system-log.service.js';
import { successResponse, errorResponse } from '@/common/utils/response.js';
import { prisma } from '@/config/prisma.js';
import { redis } from '@/config/redis.js';

export class SystemController {
    async getLogs(
        request: FastifyRequest<{ Querystring: { limit?: string; category?: string; level?: string } }>,
        reply: FastifyReply
    ) {
        try {
            const limit = request.query.limit ? parseInt(request.query.limit) : 50;
            const logs = await systemLogService.list({
                limit,
                category: request.query.category,
                level: request.query.level
            });

            return reply.send(successResponse(logs));
        } catch (error) {
            request.log.error(error, 'Failed to fetch logs');
            return reply.status(500).send(errorResponse('Failed to fetch logs'));
        }
    }

    async getStatus(request: FastifyRequest, reply: FastifyReply) {
        try {
            // Rapid checks
            const dbStart = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            const dbLatency = Date.now() - dbStart;

            const redisStart = Date.now();
            await redis.ping();
            const redisLatency = Date.now() - redisStart;

            return reply.send(successResponse({
                status: 'ONLINE',
                services: {
                    database: { status: 'UP', latency: dbLatency },
                    redis: { status: 'UP', latency: redisLatency }
                },
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            return reply.status(503).send(successResponse({
                status: 'OFFLINE',
                error: (error as Error).message
            }));
        }
    }
}

export const systemController = new SystemController();
