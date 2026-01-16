import { z } from 'zod';

export const CheckInTypeSchema = z.enum([
    'WEIGHT',
    'MOOD',
    'DIET_ADHERENCE',
    'STEPS',
    'SLEEP',
    'FREE_TEXT',
]);

export const createCheckInSchema = z.object({
    type: CheckInTypeSchema,
    valueNumber: z.number().optional(),
    valueText: z.string().optional(),
    valueBool: z.boolean().optional(),
    media: z.object({
        type: z.enum(['photo', 'audio']),
        url: z.string().url(),
        mimeType: z.string().optional(),
        durationSec: z.number().optional(),
        transcript: z.string().optional(),
        notes: z.string().optional(),
    }).optional(),
});

export const getCheckInsSchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    type: CheckInTypeSchema.optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateCheckInDto = z.infer<typeof createCheckInSchema>;
