import { FastifyRequest, FastifyReply } from 'fastify';
import { engagementService } from './engagement.service.js';

export const engagementController = {
    async getPatientEngagement(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const result = await engagementService.calculateEngagement(req.params.id);
            return reply.send({ success: true, data: result });
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ success: false, error: 'Failed to calculate engagement' });
        }
    },

    async getEngagementAnalytics(
        req: FastifyRequest,
        reply: FastifyReply
    ) {
        try {
            const result = await engagementService.getAnalyticsOverview();
            return reply.send({ success: true, data: result });
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ success: false, error: 'Failed to get analytics' });
        }
    }
};
