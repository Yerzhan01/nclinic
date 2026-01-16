import type { FastifyInstance } from 'fastify';
import { aiController } from './ai.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function aiIntegrationRouter(app: FastifyInstance) {
    // All admin routes require authentication
    app.addHook('preHandler', authPreHandler);

    // POST /connect - Save AI API key and model
    app.post('/connect', async (request, reply) => {
        return aiController.connect(request, reply);
    });

    // GET /status - Get AI connection status
    app.get('/status', async (request, reply) => {
        return aiController.getStatus(request, reply);
    });

    // GET /settings - Get full AI settings
    app.get('/settings', async (request, reply) => {
        return aiController.getSettings(request, reply);
    });

    // PUT /settings - Update AI settings
    app.put('/settings', async (request, reply) => {
        return aiController.updateSettings(request, reply);
    });

    // POST /test - Test AI analysis
    app.post('/test', async (request, reply) => {
        return aiController.test(request, reply);
    });

    // Patient AI toggle endpoints
    app.post('/patients/:patientId/ai-toggle', async (request, reply) => {
        return aiController.togglePatientAI(request, reply);
    });

    app.get('/patients/:patientId/ai-status', async (request, reply) => {
        return aiController.getPatientAIStatus(request, reply);
    });
}
