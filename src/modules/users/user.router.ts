import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './user.service.js';
import { createUserSchema, updateUserSchema, userIdParamSchema } from './user.schema.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';
import { AppError } from '@/common/errors/AppError.js';
import { successResponse } from '@/common/utils/response.js';

const userService = new UserService();

// Admin-only middleware
async function adminOnly(request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user || request.user.role !== 'ADMIN') {
        throw AppError.forbidden('Admin access required');
    }
}

export default async function usersRouter(app: FastifyInstance) {
    // All routes require authentication
    app.addHook('preHandler', authPreHandler);

    // GET /users - List all users (ADMIN only)
    app.get(
        '/',
        {
            preHandler: [adminOnly],
        },
        async (_request, reply) => {
            const users = await userService.findAll();
            return reply.send(successResponse(users));
        }
    );

    // POST /users - Create user (ADMIN only)
    app.post(
        '/',
        {
            preHandler: [adminOnly],
        },
        async (request, reply) => {
            const body = createUserSchema.parse(request.body);
            const user = await userService.create(body);
            return reply.status(201).send(successResponse(user));
        }
    );

    // GET /users/:id - Get user by ID (ADMIN only)
    app.get(
        '/:id',
        {
            preHandler: [adminOnly],
        },
        async (request, reply) => {
            const { id } = userIdParamSchema.parse(request.params);
            const user = await userService.findById(id);
            return reply.send(successResponse(user));
        }
    );

    // PUT /users/:id - Update user (ADMIN only)
    app.put(
        '/:id',
        {
            preHandler: [adminOnly],
        },
        async (request, reply) => {
            const { id } = userIdParamSchema.parse(request.params);
            const body = updateUserSchema.parse(request.body);
            const user = await userService.update(id, body);
            return reply.send(successResponse(user));
        }
    );

    // DELETE /users/:id - Soft delete user (ADMIN only)
    app.delete(
        '/:id',
        {
            preHandler: [adminOnly],
        },
        async (request, reply) => {
            const { id } = userIdParamSchema.parse(request.params);
            await userService.delete(id);
            return reply.send(successResponse({ message: 'User deactivated successfully' }));
        }
    );
}
