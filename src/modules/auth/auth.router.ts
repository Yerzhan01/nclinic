import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthController } from './auth.controller.js';
import { AppError } from '@/common/errors/AppError.js';

// Auth preHandler to verify JWT and populate request.user
export async function authPreHandler(request: FastifyRequest, _reply: FastifyReply) {
    try {
        await request.jwtVerify();
    } catch {
        throw AppError.unauthorized('Invalid or missing token');
    }
}

export default async function authRouter(app: FastifyInstance) {
    const controller = new AuthController(app);

    // Public routes
    app.post('/login', async (request, reply) => {
        return controller.login(request, reply);
    });

    // Protected routes
    app.get(
        '/me',
        {
            preHandler: [authPreHandler],
        },
        async (request, reply) => {
            return controller.me(request, reply);
        }
    );
}
