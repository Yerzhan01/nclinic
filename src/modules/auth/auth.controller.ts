import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { loginSchema } from './auth.schema.js';
import { AuthService } from './auth.service.js';
import { successResponse } from '@/common/utils/response.js';

export class AuthController {
    private readonly authService: AuthService;

    constructor(app: FastifyInstance) {
        this.authService = new AuthService(app);
    }

    async login(request: FastifyRequest, reply: FastifyReply) {
        const body = loginSchema.parse(request.body);
        const result = await this.authService.login(body);
        return reply.send(successResponse(result));
    }

    async me(request: FastifyRequest, reply: FastifyReply) {
        const { user } = request;
        if (!user) {
            return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }
        const profile = await this.authService.getProfile(user.id);
        return reply.send(successResponse(profile));
    }
}
