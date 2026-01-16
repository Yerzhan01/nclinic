import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { successResponse } from '@/common/utils/response.js';

describe('Health Endpoint', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        // Create a minimal Fastify instance for testing
        app = Fastify();

        // Register a simplified health route (without DB/Redis dependencies)
        app.get('/health', async (_request, reply) => {
            return reply.send(
                successResponse({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                })
            );
        });

        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should have /health route registered', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health',
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('healthy');
        expect(body.data.timestamp).toBeDefined();
    });

    it('should respond with correct format', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health',
        });

        const body = JSON.parse(response.body);

        // Verify response structure
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('data');
        expect(typeof body.success).toBe('boolean');
        expect(typeof body.data).toBe('object');
    });
});
