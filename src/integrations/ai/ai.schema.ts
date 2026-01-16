import { z } from 'zod';

export const connectAISchema = z.object({
    apiKey: z.string().min(1, 'API Key is required'),
    model: z.string().default('gpt-4.1'),
    temperature: z.number().min(0).max(2).default(0.2),
});

export const testAISchema = z.object({
    text: z.string().min(1, 'Text is required'),
});

export type ConnectAIInput = z.infer<typeof connectAISchema>;
export type TestAIInput = z.infer<typeof testAISchema>;
