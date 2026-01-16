import { z } from 'zod';

export const connectWhatsAppSchema = z.object({
    idInstance: z.string().min(1, 'Instance ID is required'),
    apiTokenInstance: z.string().min(1, 'API Token is required'),
    apiUrl: z.string().url('Invalid API URL').default('https://api.green-api.com'),
    mediaUrl: z.string().url('Invalid Media URL').default('https://media.green-api.com'),
});

export type ConnectWhatsAppInput = z.infer<typeof connectWhatsAppSchema>;
