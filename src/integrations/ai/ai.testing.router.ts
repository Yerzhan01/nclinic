import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { aiABTestService } from './ai.ab-test.service.js';
import { aiQualityService } from './ai.quality.service.js';
import { successResponse, errorResponse } from '@/common/utils/response.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

// Schemas
const createVariantSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    systemPrompt: z.string().min(10),
    styleGuide: z.string().optional(),
    weight: z.number().int().min(0).max(100).optional(),
});

const updateVariantSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    systemPrompt: z.string().min(10).optional(),
    styleGuide: z.string().optional(),
    weight: z.number().int().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
});

export async function registerAITestingRoutes(fastify: FastifyInstance): Promise<void> {
    // Add auth to all routes
    fastify.addHook('preHandler', authPreHandler);

    // ============================================================
    // PROMPT VARIANTS (A/B Testing)
    // ============================================================

    // Get all variants with metrics
    fastify.get('/prompt-variants', async (_request: FastifyRequest, reply: FastifyReply) => {
        const variants = await aiABTestService.getAllVariants();
        return reply.send(successResponse(variants));
    });

    // Get single variant
    fastify.get('/prompt-variants/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const variant = await aiABTestService.getVariant(request.params.id);
        if (!variant) {
            return reply.status(404).send(errorResponse('Variant not found'));
        }
        return reply.send(successResponse(variant));
    });

    // Create variant
    fastify.post('/prompt-variants', async (request: FastifyRequest, reply: FastifyReply) => {
        const data = createVariantSchema.parse(request.body);
        const variant = await aiABTestService.createVariant(data);
        return reply.status(201).send(successResponse(variant));
    });

    // Update variant
    fastify.put('/prompt-variants/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const data = updateVariantSchema.parse(request.body);
        const variant = await aiABTestService.updateVariant(request.params.id, data);
        return reply.send(successResponse(variant));
    });

    // Toggle variant active status
    fastify.post('/prompt-variants/:id/toggle', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const variant = await aiABTestService.toggleVariant(request.params.id);
        return reply.send(successResponse(variant));
    });

    // Delete variant
    fastify.delete('/prompt-variants/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        await aiABTestService.deleteVariant(request.params.id);
        return reply.send(successResponse({ deleted: true }));
    });

    // Reset metrics
    fastify.post('/prompt-variants/:id/reset-metrics', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        await aiABTestService.resetMetrics(request.params.id);
        return reply.send(successResponse({ reset: true }));
    });

    // ============================================================
    // QUALITY ANALYTICS
    // ============================================================

    // Get quality stats
    fastify.get('/quality/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
        const stats = await aiQualityService.getQualityStats();
        return reply.send(successResponse(stats));
    });

    // Get recent quality logs
    fastify.get('/quality/logs', async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
        const limit = parseInt(request.query.limit || '20', 10);
        const logs = await aiQualityService.getRecentLogs(limit);
        return reply.send(successResponse(logs));
    });
}
