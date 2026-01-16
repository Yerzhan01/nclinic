import { FastifyInstance } from 'fastify';
import { engagementController } from './engagement.controller.js';

export async function engagementRoutes(fastify: FastifyInstance) {
    fastify.get('/patients/:id/engagement', engagementController.getPatientEngagement);
    fastify.get('/analytics/engagement', engagementController.getEngagementAnalytics);
}
