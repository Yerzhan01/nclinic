import { z } from 'zod';

export const connectAmoCRMSchema = z.object({
    baseDomain: z.string().min(1, 'Base domain is required'),
    accessToken: z.string().min(1, 'Access token is required'),
    pipelineId: z.number().optional(),
    statusId: z.number().optional(),
    mappings: z.record(z.string(), z.object({
        pipelineId: z.number(),
        statusId: z.number(),
    })).optional(),
});

export type ConnectAmoCRMInput = z.infer<typeof connectAmoCRMSchema>;
