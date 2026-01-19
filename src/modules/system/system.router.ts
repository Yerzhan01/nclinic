import { FastifyInstance } from 'fastify';
import { systemController } from './system.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function systemRouter(fastify: FastifyInstance) {
    // Only authenticated users should access this
    fastify.addHook('preHandler', authPreHandler);

    fastify.get('/logs', systemController.getLogs.bind(systemController));
    fastify.get('/status', systemController.getStatus.bind(systemController));
}
