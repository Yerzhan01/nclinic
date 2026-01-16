import type { FastifyInstance } from 'fastify';
import { checkInController } from './checkin.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function checkInRouter(app: FastifyInstance) {
    app.addHook('preHandler', authPreHandler);

    app.post('/patients/:patientId/check-ins', async (req, res) => {
        return checkInController.create(req, res);
    });

    app.get('/patients/:patientId/check-ins', async (req, res) => {
        return checkInController.findAll(req, res);
    });

    app.post('/patients/:patientId/check-ins/summary', async (req, res) => {
        return checkInController.generateSummary(req, res);
    });
}
