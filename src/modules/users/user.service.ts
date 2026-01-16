import bcrypt from 'bcrypt';
import type { UserRole } from '@prisma/client';
import { prisma } from '@/config/prisma.js';
import { AppError } from '@/common/errors/AppError.js';
import type { UserDto, CreateUserInput, UpdateUserInput } from './user.types.js';

const BCRYPT_ROUNDS = 12;

export class UserService {
    async findAll(): Promise<UserDto[]> {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return users.map(this.toDto);
    }

    async findById(id: string): Promise<UserDto> {
        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw AppError.notFound('User not found');
        }

        return this.toDto(user);
    }

    async create(data: CreateUserInput): Promise<UserDto> {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw AppError.conflict('Email already exists');
        }

        const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                role: data.role as UserRole,
                fullName: data.fullName,
            },
        });

        return this.toDto(user);
    }

    async update(id: string, data: UpdateUserInput): Promise<UserDto> {
        const existingUser = await prisma.user.findUnique({
            where: { id },
        });

        if (!existingUser) {
            throw AppError.notFound('User not found');
        }

        // If email is being updated, check for uniqueness
        if (data.email && data.email !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: data.email },
            });

            if (emailExists) {
                throw AppError.conflict('Email already exists');
            }
        }

        const updateData: Record<string, unknown> = {};

        if (data.email) {
            updateData.email = data.email;
        }
        if (data.password) {
            updateData.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
        }
        if (data.role) {
            updateData.role = data.role;
        }
        if (data.fullName) {
            updateData.fullName = data.fullName;
        }
        if (typeof data.isActive === 'boolean') {
            updateData.isActive = data.isActive;
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
        });

        return this.toDto(user);
    }

    async delete(id: string): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw AppError.notFound('User not found');
        }

        // Soft delete by setting isActive to false
        await prisma.user.update({
            where: { id },
            data: { isActive: false },
        });
    }

    private toDto(user: {
        id: string;
        email: string;
        passwordHash: string;
        role: UserRole;
        fullName: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }): UserDto {
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
