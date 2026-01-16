import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import type { AIErrorType } from '@prisma/client';

// Patterns to detect AI response errors in patient replies
const ERROR_PATTERNS: Record<AIErrorType, RegExp[]> = {
    CONFUSION: [
        /^(что|не понял|повтори|причем|непонятно|как это|\?\?+)[\?\.\!]*$/i,
        /не понимаю/i,
        /что ты имеешь/i,
        /о чём ты/i,
        /при чём тут/i,
    ],
    COMPLAINT: [
        /тупой бот/i,
        /бесполезн/i,
        /ты не понимаешь/i,
        /не помогаешь/i,
        /надоел/i,
        /дурацкий/i,
        /бред/i,
    ],
    HANDOFF_REQUEST: [
        /позови (человека|менеджера|врача|оператора)/i,
        /хочу с человеком/i,
        /дай (менеджера|оператора)/i,
        /свяжи с (врачом|менеджером)/i,
        /живой человек/i,
    ],
    REPEAT_QUESTION: [], // Detected differently - by comparing to previous messages
};

export class AIQualityService {
    /**
     * Analyze patient reply for AI quality issues
     * Called after each patient message that followed an AI response
     */
    async analyzePatientReply(patientId: string, patientMessage: { id: string; content: string | null }): Promise<void> {
        if (!patientMessage.content) return;

        // Get previous message (should be AI response)
        const prevMessage = await prisma.message.findFirst({
            where: {
                patientId,
                createdAt: { lt: new Date() }, // Before this message
                sender: 'AI',
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                content: true,
                promptVariantId: true,
                createdAt: true,
            },
        });

        if (!prevMessage) return;

        // Check time gap - if more than 1 hour, ignore (patient might be responding to something else)
        const timeDiff = Date.now() - prevMessage.createdAt.getTime();
        if (timeDiff > 60 * 60 * 1000) return;

        // Detect error type
        const errorType = this.detectError(patientMessage.content);
        if (!errorType) return;

        // Log the quality issue
        await this.logQualityIssue({
            patientId,
            errorType,
            aiMessageId: prevMessage.id,
            patientReplyId: patientMessage.id,
            aiContent: prevMessage.content || '',
            patientReply: patientMessage.content,
            promptVariantId: prevMessage.promptVariantId,
        });

        logger.info({
            patientId,
            errorType,
            aiMessage: prevMessage.content?.substring(0, 100),
            patientReply: patientMessage.content.substring(0, 100),
        }, 'AI quality issue detected');

        // Update variant metrics if applicable
        if (prevMessage.promptVariantId) {
            await this.updateVariantErrorCount(prevMessage.promptVariantId);
        }
    }

    /**
     * Detect error type from patient message
     */
    detectError(text: string): AIErrorType | null {
        for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
            if (patterns.length === 0) continue; // REPEAT_QUESTION handled separately
            if (patterns.some(p => p.test(text))) {
                return type as AIErrorType;
            }
        }
        return null;
    }

    /**
     * Log quality issue to database
     */
    private async logQualityIssue(data: {
        patientId: string;
        errorType: AIErrorType;
        aiMessageId: string;
        patientReplyId: string;
        aiContent: string;
        patientReply: string;
        promptVariantId: string | null;
    }): Promise<void> {
        await prisma.aIQualityLog.create({
            data: {
                patientId: data.patientId,
                errorType: data.errorType,
                aiMessageId: data.aiMessageId,
                patientReplyId: data.patientReplyId,
                aiContent: data.aiContent,
                patientReply: data.patientReply,
                promptVariantId: data.promptVariantId,
            },
        });
    }

    /**
     * Update variant error count for A/B testing metrics
     */
    private async updateVariantErrorCount(variantId: string): Promise<void> {
        await prisma.promptVariant.update({
            where: { id: variantId },
            data: { errorCount: { increment: 1 } },
        });
    }

    /**
     * Get quality stats for analytics
     */
    async getQualityStats(): Promise<{
        today: { total: number; byType: Record<string, number> };
        week: { total: number; byType: Record<string, number> };
    }> {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);

        const [todayLogs, weekLogs] = await Promise.all([
            prisma.aIQualityLog.findMany({
                where: { createdAt: { gte: todayStart } },
                select: { errorType: true },
            }),
            prisma.aIQualityLog.findMany({
                where: { createdAt: { gte: weekStart } },
                select: { errorType: true },
            }),
        ]);

        const countByType = (logs: { errorType: string }[]): Record<string, number> => {
            const result: Record<string, number> = {};
            for (const log of logs) {
                result[log.errorType] = (result[log.errorType] || 0) + 1;
            }
            return result;
        };

        return {
            today: {
                total: todayLogs.length,
                byType: countByType(todayLogs),
            },
            week: {
                total: weekLogs.length,
                byType: countByType(weekLogs),
            },
        };
    }

    /**
     * Get recent error logs for analytics detail view
     */
    async getRecentLogs(limit: number = 20): Promise<Array<{
        id: string;
        patientId: string;
        patientName: string;
        errorType: string;
        aiContent: string;
        patientReply: string;
        createdAt: Date;
    }>> {
        const logs = await prisma.aIQualityLog.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                patient: {
                    select: { fullName: true },
                },
            },
        });

        return logs.map(log => ({
            id: log.id,
            patientId: log.patientId,
            patientName: log.patient.fullName,
            errorType: log.errorType,
            aiContent: log.aiContent,
            patientReply: log.patientReply,
            createdAt: log.createdAt,
        }));
    }
}

export const aiQualityService = new AIQualityService();
