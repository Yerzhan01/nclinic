import { z } from 'zod';

export const createPatientSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    phone: z.string().min(10, 'Phone number is too short'),
    clinicId: z.string().optional(),
    programStartDate: z.string().datetime().optional(), // ISO date string
    templateId: z.string().optional(),
    chatMode: z.enum(['AI', 'HUMAN', 'PAUSED']).optional(),
    metadata: z.record(z.unknown()).optional(),
    timezone: z.string().optional(),
});

export const updatePatientSchema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    chatMode: z.enum(['AI', 'HUMAN', 'PAUSED']).optional(),
    timezone: z.string().optional(),
});

export const listPatientsQuerySchema = z.object({
    search: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
});

export const patientIdParamSchema = z.object({
    id: z.string().min(1),
});
