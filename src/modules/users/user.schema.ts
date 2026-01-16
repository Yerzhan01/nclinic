import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['ADMIN', 'STAFF']).optional().default('STAFF'),
    fullName: z.string().min(1, 'Full name is required'),
});

export const updateUserSchema = z.object({
    email: z.string().email('Invalid email format').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    role: z.enum(['ADMIN', 'STAFF']).optional(),
    fullName: z.string().min(1, 'Full name is required').optional(),
    isActive: z.boolean().optional(),
});

export const userIdParamSchema = z.object({
    id: z.string().min(1, 'User ID is required'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
