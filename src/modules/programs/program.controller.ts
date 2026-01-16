import type { FastifyRequest, FastifyReply } from 'fastify';
import {
    assignProgramSchema,
    patientIdParamSchema,
    createTemplateSchema,
    updateTemplateSchema
} from './program.schema.js';
import { programService } from './program.service.js';
import { successResponse } from '@/common/utils/response.js';
import { AppError } from '@/common/errors/AppError.js';

export class ProgramController {
    /**
     * POST /programs/assign - Assign a program to a patient
     */
    async assignProgram(request: FastifyRequest, reply: FastifyReply) {
        const body = assignProgramSchema.parse(request.body);

        const startDate = body.startDate ? new Date(body.startDate) : undefined;

        const result = await programService.createProgramInstance({
            patientId: body.patientId,
            templateId: body.templateId,
            startDate,
        });

        return reply.status(201).send(
            successResponse({
                programInstanceId: result.programInstanceId,
                startDate: result.startDate,
                endDate: result.endDate,
            })
        );
    }

    /**
     * GET /programs/:patientId/active - Get active program and check-ins
     */
    async getActiveProgram(request: FastifyRequest, reply: FastifyReply) {
        const { patientId } = patientIdParamSchema.parse(request.params);

        const result = await programService.getActiveCheckIns(patientId);

        if (!result) {
            throw AppError.notFound('No active program found for this patient');
        }

        return reply.send(successResponse(result));
    }

    /**
     * POST /programs/mark-missed - Mark overdue check-ins as missed
     */
    async markMissedCheckIns(_request: FastifyRequest, reply: FastifyReply) {
        const count = await programService.markMissedCheckIns();

        return reply.send(
            successResponse({
                markedAsMissed: count,
            })
        );
    }

    async listTemplates(_request: FastifyRequest, reply: FastifyReply) {
        const templates = await programService.listTemplates();
        return reply.send(successResponse(templates));
    }

    async createTemplate(request: FastifyRequest, reply: FastifyReply) {
        const body = createTemplateSchema.parse(request.body);
        const template = await programService.createTemplate(body);
        return reply.status(201).send(successResponse(template));
    }

    async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
        const { id } = request.params as { id: string };
        const body = updateTemplateSchema.parse(request.body);
        const template = await programService.updateTemplate(id, body);
        return reply.send(successResponse(template));
    }

    async deleteTemplate(request: FastifyRequest, reply: FastifyReply) {
        const { id } = request.params as { id: string };
        await programService.deleteTemplate(id);
        return reply.send(successResponse({ success: true }));
    }

}

export const programController = new ProgramController();
