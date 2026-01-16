import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import { env } from '@/config/env.js';
import type { UserRole } from '@prisma/client';

// Extend FastifyJWT to type the user payload
declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            id: string;
            email: string;
            role: UserRole;
        };
        user: {
            id: string;
            email: string;
            role: UserRole;
        };
    }
}

export async function registerPlugins(app: FastifyInstance): Promise<void> {
    // CORS
    await app.register(fastifyCors, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    // Cookie parser
    await app.register(fastifyCookie, {
        secret: env.JWT_SECRET,
        hook: 'onRequest',
    });

    // JWT - automatically decorates request with 'user' after jwtVerify
    await app.register(fastifyJwt, {
        secret: env.JWT_SECRET,
        sign: {
            expiresIn: '1d', // 1 day access token
        },
    });

    // WebSocket
    await app.register(fastifyWebsocket);
}
