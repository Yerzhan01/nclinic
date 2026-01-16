import { z } from 'zod';

export const patientIdParamSchema = z.object({
    patientId: z.string().min(1, 'Patient ID is required'),
});

export const sendMessageSchema = z.object({
    text: z.string().min(1, 'Message text is required'),
});

export type PatientIdParam = z.infer<typeof patientIdParamSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
