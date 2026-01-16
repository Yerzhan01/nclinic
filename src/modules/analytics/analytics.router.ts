import type { FastifyInstance } from 'fastify';
import { analyticsController } from './analytics.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function analyticsRouter(app: FastifyInstance) {
    // Analytics is protected
    app.addHook('preHandler', authPreHandler);

    app.get('/overview', (req, reply) => analyticsController.getOverview(req as any, reply));
    app.get('/tasks-by-day', (req, reply) => analyticsController.getTasksByDay(req as any, reply));
    app.get('/problem-patients', (req, reply) => analyticsController.getProblemPatients(req as any, reply));
}
