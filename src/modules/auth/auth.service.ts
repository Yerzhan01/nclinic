import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/prisma.js';
import { AppError } from '@/common/errors/AppError.js';
import type { JwtPayload, LoginResponse, UserProfile, LoginRequest } from './auth.types.js';

export class AuthService {
    constructor(private readonly app: FastifyInstance) { }

    async login(data: LoginRequest): Promise<LoginResponse> {
        const { email, password } = data;

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw AppError.unauthorized('Invalid email or password');
        }

        // Check if user is active
        if (!user.isActive) {
            throw AppError.forbidden('Account is deactivated');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            throw AppError.unauthorized('Invalid email or password');
        }

        // Generate JWT token
        const payload: JwtPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = this.app.jwt.sign(payload);

        // Return user profile without password
        const userProfile: UserProfile = {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        return {
            accessToken,
            user: userProfile,
        };
    }

    async getProfile(userId: string): Promise<UserProfile> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw AppError.notFound('User not found');
        }

        if (!user.isActive) {
            throw AppError.forbidden('Account is deactivated');
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}
