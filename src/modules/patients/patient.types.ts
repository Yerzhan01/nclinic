import type { z } from 'zod';
import type { createPatientSchema, updatePatientSchema, listPatientsQuerySchema } from './patient.schema.js';
import type { ChatMode } from '@prisma/client';

export type CreatePatientDto = z.infer<typeof createPatientSchema>;
export type UpdatePatientDto = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

export interface PatientDto {
    id: string;
    fullName: string;
    phone: string;
    chatMode: ChatMode;
    createdAt: Date;
    updatedAt: Date;
}
