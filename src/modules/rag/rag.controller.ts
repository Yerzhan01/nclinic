import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ragService } from './rag.service.js';
import { successResponse } from '@/common/utils/response.js';

// Schemas
const sourceIdSchema = z.object({ id: z.string() });
const documentIdSchema = z.object({ id: z.string() });

const createSourceSchema = z.object({
    name: z.string().min(1),
    enabled: z.boolean().optional(),
});

const updateSourceSchema = z.object({
    name: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
});

const createDocumentSchema = z.object({
    sourceId: z.string(),
    title: z.string().min(1),
    content: z.string().min(1),
    enabled: z.boolean().optional(),
});

const updateDocumentSchema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
});

const searchQuerySchema = z.object({
    q: z.string(),
    topK: z.coerce.number().min(1).max(20).optional(),
});

const listDocumentsQuerySchema = z.object({
    sourceId: z.string().optional(),
});

export class RagController {
    // ==================== Sources ====================

    async listSources(_request: FastifyRequest, reply: FastifyReply) {
        const sources = await ragService.listSources();
        return reply.send(successResponse(sources));
    }

    async getSource(request: FastifyRequest, reply: FastifyReply) {
        const { id } = sourceIdSchema.parse(request.params);
        const source = await ragService.getSource(id);
        return reply.send(successResponse(source));
    }

    async createSource(request: FastifyRequest, reply: FastifyReply) {
        const body = createSourceSchema.parse(request.body);
        const source = await ragService.createSource(body);
        return reply.status(201).send(successResponse(source));
    }

    async updateSource(request: FastifyRequest, reply: FastifyReply) {
        const { id } = sourceIdSchema.parse(request.params);
        const body = updateSourceSchema.parse(request.body);
        const source = await ragService.updateSource(id, body);
        return reply.send(successResponse(source));
    }

    async deleteSource(request: FastifyRequest, reply: FastifyReply) {
        const { id } = sourceIdSchema.parse(request.params);
        await ragService.deleteSource(id);
        return reply.send(successResponse({ deleted: true }));
    }

    // ==================== Documents ====================

    async listDocuments(request: FastifyRequest, reply: FastifyReply) {
        const { sourceId } = listDocumentsQuerySchema.parse(request.query);
        const documents = await ragService.listDocuments(sourceId);
        return reply.send(successResponse(documents));
    }

    async getDocument(request: FastifyRequest, reply: FastifyReply) {
        const { id } = documentIdSchema.parse(request.params);
        const document = await ragService.getDocument(id);
        return reply.send(successResponse(document));
    }

    async createDocument(request: FastifyRequest, reply: FastifyReply) {
        const body = createDocumentSchema.parse(request.body);
        const document = await ragService.createDocument(body);
        return reply.status(201).send(successResponse(document));
    }

    async updateDocument(request: FastifyRequest, reply: FastifyReply) {
        const { id } = documentIdSchema.parse(request.params);
        const body = updateDocumentSchema.parse(request.body);
        const document = await ragService.updateDocument(id, body);
        return reply.send(successResponse(document));
    }

    async deleteDocument(request: FastifyRequest, reply: FastifyReply) {
        const { id } = documentIdSchema.parse(request.params);
        await ragService.deleteDocument(id);
        return reply.send(successResponse({ deleted: true }));
    }

    // ==================== Search ====================

    async search(request: FastifyRequest, reply: FastifyReply) {
        const { q, topK } = searchQuerySchema.parse(request.query);
        const results = await ragService.search(q, topK);
        return reply.send(successResponse(results));
    }
}

export const ragController = new RagController();
