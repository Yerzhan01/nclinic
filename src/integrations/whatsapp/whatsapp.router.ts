import type { FastifyInstance } from 'fastify';
import { whatsAppController } from './whatsapp.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function whatsAppIntegrationRouter(app: FastifyInstance) {
    // POST /webhook - Public Green API Webhook (No Auth)
    app.post('/webhook', async (request, reply) => {
        return whatsAppController.handleWebhook(request, reply);
    });

    // Encapsulate protected routes in a separate plugin context
    await app.register(async (protectedRoutes) => {
        protectedRoutes.addHook('preHandler', authPreHandler);

        // POST /connect - Save WhatsApp config and check connection
        protectedRoutes.post('/connect', async (request, reply) => {
            return whatsAppController.connect(request, reply);
        });

        // GET /status - Get WhatsApp connection status
        protectedRoutes.get('/status', async (request, reply) => {
            return whatsAppController.getStatus(request, reply);
        });

        // POST /reconnect - Force QR code refresh
        protectedRoutes.post('/reconnect', async (request, reply) => {
            return whatsAppController.reconnect(request, reply);
        });
    });
}
