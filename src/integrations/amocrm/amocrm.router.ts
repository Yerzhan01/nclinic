import type { FastifyInstance } from 'fastify';
import { amoCRMController } from './amocrm.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function amoCRMRouter(app: FastifyInstance) {
    // Public webhook (no auth required)
    app.post('/webhook', amoCRMController.handleWebhook.bind(amoCRMController));

    // Protected routes
    app.register(async (protectedApp) => {
        protectedApp.addHook('preHandler', authPreHandler);

        protectedApp.post('/connect', amoCRMController.connect.bind(amoCRMController));
        protectedApp.post('/test', amoCRMController.test.bind(amoCRMController));
        protectedApp.post('/disconnect', amoCRMController.disconnect.bind(amoCRMController));
        protectedApp.get('/status', amoCRMController.getStatus.bind(amoCRMController));
        protectedApp.get('/pipelines', amoCRMController.getPipelines.bind(amoCRMController));
    });
}
