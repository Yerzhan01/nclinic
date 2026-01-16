import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createCheckInSchema, getCheckInsSchema } from './checkin.schema.js';
import { checkInService } from './checkin.service.js';
import { aiService } from '@/integrations/ai/ai.service.js';
import { successResponse } from '@/common/utils/response.js';

const patientIdParam = z.object({
    patientId: z.string(),
});

export class CheckInController {
    async create(request: FastifyRequest, reply: FastifyReply) {
        const { patientId } = patientIdParam.parse(request.params);
        const dto = createCheckInSchema.parse(request.body);

        const checkIn = await checkInService.create(patientId, dto);
        return reply.status(201).send(successResponse(checkIn));
    }

    async findAll(request: FastifyRequest, reply: FastifyReply) {
        const { patientId } = patientIdParam.parse(request.params);
        const query = getCheckInsSchema.parse(request.query);

        const checkIns = await checkInService.findAll(patientId, {
            from: query.from ? new Date(query.from) : undefined,
            to: query.to ? new Date(query.to) : undefined,
            type: query.type,
            limit: query.limit,
        });

        return reply.send(successResponse(checkIns));
    }

    async generateSummary(request: FastifyRequest, reply: FastifyReply) {
        const { patientId } = patientIdParam.parse(request.params);

        // Use AI Service to generate summary based on recent check-ins
        const summary = await (aiService as any).generateCheckInSummary(patientId);

        return reply.send(successResponse(summary));
    }
}

export const checkInController = new CheckInController();
