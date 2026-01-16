import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '@/common/utils/response.js';
import { patientService } from './patient.service.js';
import { createPatientSchema, updatePatientSchema, listPatientsQuerySchema, patientIdParamSchema } from './patient.schema.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery } from './patient.types.js';

export class PatientController {
    async create(request: FastifyRequest, reply: FastifyReply) {
        const body = createPatientSchema.parse(request.body) as CreatePatientDto;
        const result = await patientService.createPatient(body);
        return reply.status(201).send(successResponse(result));
    }

    async update(request: FastifyRequest, reply: FastifyReply) {
        const { id } = patientIdParamSchema.parse(request.params);
        const body = updatePatientSchema.parse(request.body) as UpdatePatientDto;
        const result = await patientService.updatePatient(id, body);
        return reply.send(successResponse(result));
    }

    async list(request: FastifyRequest, reply: FastifyReply) {
        const query = listPatientsQuerySchema.parse(request.query) as ListPatientsQuery;
        const { items, total } = await patientService.listPatients(query);

        return reply.send(
            successResponse(items, {
                count: items.length,
                limit: query.limit,
                offset: query.offset,
                total,
            })
        );
    }

    async get(request: FastifyRequest, reply: FastifyReply) {
        const { id } = patientIdParamSchema.parse(request.params);
        const patient = await patientService.getPatientById(id);
        return reply.send(successResponse(patient));
    }

    async getProfile(request: FastifyRequest, reply: FastifyReply) {
        const { id } = patientIdParamSchema.parse(request.params);
        const profile = await patientService.getProfile(id);
        return reply.send(successResponse(profile));
    }

    async updateProfile(request: FastifyRequest, reply: FastifyReply) {
        const { id } = patientIdParamSchema.parse(request.params);
        const { PatientProfilePatchSchema } = await import('./patient-profile.schema.js');
        const patch = PatientProfilePatchSchema.parse(request.body);
        const profile = await patientService.updateProfile(id, patch);
        return reply.send(successResponse(profile));
    }

    async getTimeline(request: FastifyRequest, reply: FastifyReply) {
        const { id } = patientIdParamSchema.parse(request.params);
        const timeline = await patientService.getTimeline(id);
        return reply.send(successResponse(timeline));
    }
}

export const patientController = new PatientController();
