import { z } from 'zod';
import { Slot, CheckInType } from '@prisma/client';

export const assignProgramSchema = z.object({
    patientId: z.string().min(1, 'Patient ID is required'),
    templateId: z.string().min(1, 'Template ID is required'),
    startDate: z.string().datetime().optional(),
});

export const patientIdParamSchema = z.object({
    patientId: z.string().min(1, 'Patient ID is required'),
});

// JSON Schedule Validation
const programActivitySchema = z.object({
    slot: z.nativeEnum(Slot),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
    type: z.nativeEnum(CheckInType),
    question: z.string().min(1, 'Question text is required'),
    required: z.boolean(),
});

const programScheduleDaySchema = z.object({
    day: z.number().int().min(1),
    activities: z.array(programActivitySchema),
});

const programTemplateRulesSchema = z.object({
    schedule: z.array(programScheduleDaySchema),
});

export const createTemplateSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    durationDays: z.number().int().min(1).default(42),
    isActive: z.boolean().default(true),
    rules: programTemplateRulesSchema,
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type AssignProgramInput = z.infer<typeof assignProgramSchema>;
export type PatientIdParam = z.infer<typeof patientIdParamSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
