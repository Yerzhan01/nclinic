import type { UserRole } from '@prisma/client';

export interface JwtPayload {
    id: string;
    email: string;
    role: UserRole;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    user: UserProfile;
}

export interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    fullName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
