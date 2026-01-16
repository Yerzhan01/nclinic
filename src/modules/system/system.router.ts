
import { FastifyInstance } from 'fastify';
import { systemController } from './system.controller.js';

export default async function systemRouter(fastify: FastifyInstance) {
    // Only Admin should access this (TODO: Add AuthGuard later, for now allow Staff/Admin)

    fastify.get('/logs', systemController.getLogs.bind(systemController));
    fastify.get('/status', systemController.getStatus.bind(systemController));
}
