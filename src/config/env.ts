import { z } from 'zod';

const envSchema = z.object({
    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_URL: z.string().url(),

    // JWT
    JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters'),

    // Server
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const errors = result.error.format();
        console.error('❌ Invalid environment variables:');
        console.error(JSON.stringify(errors, null, 2));
        process.exit(1);
    }

    return result.data;
}

export const env = loadEnv();

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
