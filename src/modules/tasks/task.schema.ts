import { z } from 'zod';

export const createTaskSchema = z.object({
    patientId: z.string().min(1, 'Patient ID is required'),
    alertId: z.string().optional(),
    type: z.enum(['RISK_ALERT', 'MISSED_CHECKIN', 'FOLLOW_UP', 'CUSTOM']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    title: z.string().min(1, 'Title is required'),
    note: z.string().optional(),
    assignedToId: z.string().optional(),
    dueAt: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
});

export const updateTaskStatusSchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']),
});

export const taskIdParamSchema = z.object({
    id: z.string().min(1, 'Task ID is required'),
});

export const listTasksQuerySchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
    assignedToId: z.string().optional(),
    patientId: z.string().optional(),
    alertId: z.string().optional(),
    overdue: z.coerce.boolean().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
