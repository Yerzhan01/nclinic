import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import { aiService } from './ai.service.js';

// How many messages before generating a new summary
const SUMMARY_THRESHOLD = 30;

// How many recent messages to include when generating summary
const MESSAGES_FOR_SUMMARY = 50;

export class AISummaryService {
    /**
     * Check if summary needs update and generate if needed
     * Called after each inbound message
     */
    async checkAndUpdateSummary(patientId: string): Promise<void> {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: {
                messageCountSinceSummary: true,
                conversationSummary: true,
            },
        });

        if (!patient) return;

        // Increment message counter
        const newCount = (patient.messageCountSinceSummary || 0) + 1;
        await prisma.patient.update({
            where: { id: patientId },
            data: { messageCountSinceSummary: newCount },
        });

        // Check if threshold reached
        if (newCount >= SUMMARY_THRESHOLD) {
            logger.info({ patientId, messageCount: newCount }, 'Summary threshold reached, generating summary');
            await this.generateSummary(patientId);
        }
    }

    /**
     * Generate conversation summary using AI
     */
    async generateSummary(patientId: string): Promise<string | null> {
        const config = await aiService.getConfig();
        if (!config?.apiKey) {
            logger.warn('Cannot generate summary: AI not configured');
            return null;
        }

        // Get patient with existing summary
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: {
                fullName: true,
                conversationSummary: true,
            },
        });

        if (!patient) return null;

        // Get recent messages
        const messages = await prisma.message.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
            take: MESSAGES_FOR_SUMMARY,
            select: {
                content: true,
                sender: true,
                createdAt: true,
            },
        });

        if (messages.length < 10) {
            logger.info({ patientId }, 'Not enough messages for summary');
            return null;
        }

        // Format messages for prompt (reverse to chronological order)
        const formattedMessages = messages.reverse().map(m => {
            const sender = m.sender === 'PATIENT' ? patient.fullName : m.sender;
            return `[${sender}]: ${m.content || '[медиа]'}`;
        }).join('\n');

        // Build summary prompt
        const prompt = this.buildSummaryPrompt(patient.conversationSummary, formattedMessages);

        try {
            const summary = await this.callAIForSummary(config.apiKey, config.model || 'gpt-4o-mini', prompt);

            if (summary) {
                // Save summary to patient
                await prisma.patient.update({
                    where: { id: patientId },
                    data: {
                        conversationSummary: summary,
                        conversationSummaryAt: new Date(),
                        messageCountSinceSummary: 0,
                    },
                });

                logger.info({ patientId, summaryLength: summary.length }, 'Conversation summary updated');
                return summary;
            }
        } catch (error) {
            logger.error({ error, patientId }, 'Failed to generate conversation summary');
        }

        return null;
    }

    /**
     * Build prompt for summary generation
     */
    private buildSummaryPrompt(existingSummary: string | null, recentMessages: string): string {
        return `Ты — ассистент. Твоя задача — сжать историю разговора в 3-5 предложений для использования как контекст в будущих ответах.

${existingSummary ? `ПРЕДЫДУЩЕЕ РЕЗЮМЕ:
${existingSummary}

` : ''}НОВЫЕ СООБЩЕНИЯ:
${recentMessages}

ЗАДАЧА:
Напиши краткое резюме всего разговора (объедини старое резюме с новыми сообщениями).
Сохрани ключевые факты:
- Проблемы и жалобы пациента
- Данные рекомендации
- Договорённости и планы
- Важные события (пропуски, успехи)

Пиши от третьего лица: "Пациент спрашивал...", "Ему рекомендовали..."
Максимум 5 предложений.`;
    }

    /**
     * Call OpenAI API for summary generation
     */
    private async callAIForSummary(apiKey: string, model: string, prompt: string): Promise<string | null> {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.3,
                    max_tokens: 500,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error({ status: response.status, error: errorText }, 'OpenAI summary API error');
                return null;
            }

            const data = await response.json() as {
                choices?: Array<{ message?: { content?: string } }>;
            };

            return data.choices?.[0]?.message?.content?.trim() || null;
        } catch (error) {
            logger.error({ error }, 'Failed to call OpenAI for summary');
            return null;
        }
    }

    /**
     * Get conversation summary for a patient
     */
    async getSummary(patientId: string): Promise<string | null> {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { conversationSummary: true },
        });
        return patient?.conversationSummary || null;
    }

    /**
     * Force regenerate summary (for testing or manual trigger)
     */
    async forceRegenerate(patientId: string): Promise<string | null> {
        return this.generateSummary(patientId);
    }
}

export const aiSummaryService = new AISummaryService();
