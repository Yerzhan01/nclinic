import type { FastifyInstance } from 'fastify';
import { alertController } from './alert.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function alertRouter(app: FastifyInstance) {
    // All routes require authentication
    app.addHook('preHandler', authPreHandler);

    // GET /alerts - List active alerts
    app.get('/', async (request, reply) => {
        return alertController.listAlerts(request, reply);
    });

    // GET /alerts/:id - Get alert by ID
    app.get('/:id', async (request, reply) => {
        return alertController.getAlert(request, reply);
    });

    // POST /alerts/:id/resolve - Resolve an alert
    app.post('/:id/resolve', async (request, reply) => {
        return alertController.resolveAlert(request, reply);
    });
}
