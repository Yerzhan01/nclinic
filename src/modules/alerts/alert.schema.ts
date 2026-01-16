import { z } from 'zod';

export const alertIdParamSchema = z.object({
    id: z.string().min(1, 'Alert ID is required'),
});

export const resolveAlertSchema = z.object({
    note: z.string().optional(),
});

export const listAlertsQuerySchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
    level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    patientId: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
});

export type AlertIdParam = z.infer<typeof alertIdParamSchema>;
export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>;
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
