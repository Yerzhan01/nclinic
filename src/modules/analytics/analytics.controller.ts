import type { FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService } from './analytics.service.js';
import { successResponse } from '@/common/utils/response.js';

export class AnalyticsController {
    async getOverview(request: FastifyRequest<{ Querystring: { from?: string; to?: string } }>, reply: FastifyReply) {
        const data = await analyticsService.getOverview(request.query);
        return reply.send(successResponse(data));
    }

    async getTasksByDay(request: FastifyRequest<{ Querystring: { from?: string; to?: string } }>, reply: FastifyReply) {
        const data = await analyticsService.getTasksByDay(request.query);
        return reply.send(successResponse(data));
    }

    async getProblemPatients(request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) {
        const limit = request.query.limit ? Number(request.query.limit) : 10;
        const data = await analyticsService.getProblemPatients(limit);
        return reply.send(successResponse(data));
    }
}

export const analyticsController = new AnalyticsController();
