import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import type { PromptVariant } from '@prisma/client';

export class AIABTestService {
    /**
     * Select a prompt variant based on weights
     * Uses weighted random selection among active variants
     */
    async selectVariant(): Promise<PromptVariant | null> {
        const variants = await prisma.promptVariant.findMany({
            where: { isActive: true },
        });

        if (variants.length === 0) return null;
        if (variants.length === 1) return variants[0];

        // Weighted random selection
        const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
        if (totalWeight === 0) return variants[0];

        let random = Math.random() * totalWeight;

        for (const variant of variants) {
            random -= variant.weight;
            if (random <= 0) {
                logger.debug({ variantId: variant.id, variantName: variant.name }, 'Selected prompt variant');
                return variant;
            }
        }

        return variants[0];
    }

    /**
     * Update variant metrics after message sent
     */
    async updateVariantMessageCount(variantId: string): Promise<void> {
        await prisma.promptVariant.update({
            where: { id: variantId },
            data: { totalMessages: { increment: 1 } },
        });
    }

    /**
     * Update variant handoff count
     */
    async updateVariantHandoffCount(variantId: string): Promise<void> {
        await prisma.promptVariant.update({
            where: { id: variantId },
            data: { handoffCount: { increment: 1 } },
        });
    }

    /**
     * Get all variants with metrics for admin UI
     */
    async getAllVariants(): Promise<Array<{
        id: string;
        name: string;
        description: string | null;
        weight: number;
        isActive: boolean;
        totalMessages: number;
        errorCount: number;
        handoffCount: number;
        errorRate: number;
        handoffRate: number;
        createdAt: Date;
        updatedAt: Date;
    }>> {
        const variants = await prisma.promptVariant.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return variants.map(v => ({
            id: v.id,
            name: v.name,
            description: v.description,
            weight: v.weight,
            isActive: v.isActive,
            totalMessages: v.totalMessages,
            errorCount: v.errorCount,
            handoffCount: v.handoffCount,
            errorRate: v.totalMessages > 0 ? (v.errorCount / v.totalMessages) * 100 : 0,
            handoffRate: v.totalMessages > 0 ? (v.handoffCount / v.totalMessages) * 100 : 0,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
        }));
    }

    /**
     * Get single variant with full prompt
     */
    async getVariant(id: string): Promise<PromptVariant | null> {
        return prisma.promptVariant.findUnique({
            where: { id },
        });
    }

    /**
     * Create new variant
     */
    async createVariant(data: {
        name: string;
        description?: string;
        systemPrompt: string;
        styleGuide?: string;
        weight?: number;
    }): Promise<PromptVariant> {
        const variant = await prisma.promptVariant.create({
            data: {
                name: data.name,
                description: data.description,
                systemPrompt: data.systemPrompt,
                styleGuide: data.styleGuide,
                weight: data.weight ?? 50,
            },
        });

        logger.info({ variantId: variant.id, name: variant.name }, 'Created prompt variant');
        return variant;
    }

    /**
     * Update variant
     */
    async updateVariant(id: string, data: {
        name?: string;
        description?: string;
        systemPrompt?: string;
        styleGuide?: string;
        weight?: number;
        isActive?: boolean;
    }): Promise<PromptVariant> {
        const variant = await prisma.promptVariant.update({
            where: { id },
            data,
        });

        logger.info({ variantId: variant.id, name: variant.name }, 'Updated prompt variant');
        return variant;
    }

    /**
     * Toggle variant active status
     */
    async toggleVariant(id: string): Promise<PromptVariant> {
        const current = await prisma.promptVariant.findUnique({
            where: { id },
            select: { isActive: true },
        });

        if (!current) throw new Error('Variant not found');

        return this.updateVariant(id, { isActive: !current.isActive });
    }

    /**
     * Delete variant
     */
    async deleteVariant(id: string): Promise<void> {
        await prisma.promptVariant.delete({
            where: { id },
        });

        logger.info({ variantId: id }, 'Deleted prompt variant');
    }

    /**
     * Reset variant metrics (for testing)
     */
    async resetMetrics(id: string): Promise<void> {
        await prisma.promptVariant.update({
            where: { id },
            data: {
                totalMessages: 0,
                errorCount: 0,
                handoffCount: 0,
            },
        });
    }
}

export const aiABTestService = new AIABTestService();
