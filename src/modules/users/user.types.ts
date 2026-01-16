import type { UserRole } from '@prisma/client';

export interface UserDto {
    id: string;
    email: string;
    role: UserRole;
    fullName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserInput {
    email: string;
    password: string;
    role?: UserRole;
    fullName: string;
}

export interface UpdateUserInput {
    email?: string;
    password?: string;
    role?: UserRole;
    fullName?: string;
    isActive?: boolean;
}
