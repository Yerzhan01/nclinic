import type { FastifyInstance } from 'fastify';
import { messageController } from './message.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function messageRouter(app: FastifyInstance) {
    // Chat API routes require authentication
    app.get(
        '/:patientId',
        { preHandler: [authPreHandler] },
        async (request, reply) => {
            return messageController.getMessages(request, reply);
        }
    );

    app.post(
        '/:patientId/send',
        { preHandler: [authPreHandler] },
        async (request, reply) => {
            return messageController.sendMessage(request, reply);
        }
    );
}


