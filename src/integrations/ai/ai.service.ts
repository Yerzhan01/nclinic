import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import { taskService } from '@/modules/tasks/task.service.js';
import { TaskType, TaskPriority, TaskSource, CheckInSource } from '@prisma/client';
import type { AIConfig, AIAnalysisResult, AIConnectionStatus, ExtractedCheckIn, ImageAnalysisResult } from './ai.types.js';
import { DEFAULT_AGENT_SETTINGS } from './ai.types.js';
import { systemLogService } from '@/modules/system/system-log.service.js';
import { aiPromptBuilder } from './ai.prompt.builder.js';

// Max context length to prevent token overflow
const MAX_CONTEXT_LENGTH = 1200;

export class AIService {

    /**
     * Get AI config from IntegrationSettings
     */
    async getConfig(): Promise<AIConfig | null> {
        const settings = await prisma.integrationSettings.findUnique({
            where: { type: 'ai' },
        });

        if (!settings || !settings.isEnabled) {
            return null;
        }

        const config = settings.config as unknown as AIConfig;
        return config;
    }

    /**
     * Save AI config to IntegrationSettings
     */
    async saveConfig(config: AIConfig): Promise<void> {
        await prisma.integrationSettings.upsert({
            where: { type: 'ai' },
            update: {
                config: config as object,
                isEnabled: true,
            },
            create: {
                type: 'ai',
                config: config as object,
                isEnabled: true,
            },
        });
    }

    /**
     * Get full AI settings for Control Center
     */
    async getSettings(): Promise<AIConfig | null> {
        return this.getConfig();
    }

    /**
     * Update AI settings from Control Center
     */
    async updateSettings(partial: Partial<AIConfig>): Promise<AIConfig> {
        const current = await this.getConfig();
        const merged: AIConfig = {
            apiKey: partial.apiKey ?? current?.apiKey ?? '',
            model: partial.model ?? current?.model ?? 'gpt-4o-mini',
            temperature: partial.temperature ?? current?.temperature,
            messageBufferSeconds: partial.messageBufferSeconds ?? current?.messageBufferSeconds ?? 10,
            agent: {
                ...DEFAULT_AGENT_SETTINGS,
                ...current?.agent,
                ...partial.agent
            },
            rag: {
                ...current?.rag,
                ...partial.rag
            },
        };
        logger.info({ partial, merged }, 'Updating AI settings');
        await this.saveConfig(merged);
        return merged;
    }

    /**
     * Get connection status
     */
    async getStatus(): Promise<AIConnectionStatus> {
        const config = await this.getConfig();

        if (!config) {
            return { isEnabled: false, status: 'disconnected' };
        }

        try {
            await this.testConnection(config);
            return {
                isEnabled: true,
                status: 'connected',
                model: config.model,
            };
        } catch (error) {
            const err = error as Error;
            return {
                isEnabled: true,
                status: 'error',
                model: config.model,
                error: err.message,
            };
        }
    }

    /**
     * Test connection to OpenAI
     */
    private async testConnection(config: AIConfig): Promise<void> {
        const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
    }

    /**
     * Check if text contains any trigger words (case-insensitive)
     */
    private containsTrigger(text: string, triggers: string[]): boolean {
        const lowerText = text.toLowerCase();
        return triggers.some(trigger => lowerText.includes(trigger.toLowerCase()));
    }

    /**
     * Analyze message using OpenAI
     */
    /**
     * Analyze message using OpenAI
     */
    async analyzeMessage(text: string, patientId: string): Promise<AIAnalysisResult | null> {
        const config = await this.getConfig();

        if (!config) {
            logger.warn('AI not configured, skipping analysis');
            return null;
        }

        const agentSettings = config.agent ?? DEFAULT_AGENT_SETTINGS;

        // Check handoff triggers BEFORE calling OpenAI (fast path)
        const triggers = agentSettings.handoffTriggers ?? DEFAULT_AGENT_SETTINGS.handoffTriggers ?? [];
        if (triggers.length > 0 && this.containsTrigger(text, triggers)) {
            logger.info({ patientId, triggers }, 'Handoff trigger detected, instant handoff');
            return {
                sentiment: 'neutral',
                riskLevel: 'HIGH',
                summary: 'Обнаружены стоп-слова/тревожные жалобы',
                shouldReply: false,
                handoffRequired: true,
            };
        }

        // Fetch recent messages for prompt builder
        const recentMessages = await prisma.message.findMany({
            where: { patientId },
            orderBy: { createdAt: 'asc' }, // History order
            take: 20
        });

        const { prompt, variantId } = await aiPromptBuilder.buildPrompt(patientId, recentMessages);

        // Build conversation history for context (last 10 messages)
        const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        const historyMessages = recentMessages.slice(-10); // Last 10 messages

        for (const msg of historyMessages) {
            if (msg.content) {
                const role = msg.sender === 'PATIENT' ? 'user' : 'assistant';
                conversationHistory.push({ role, content: msg.content });
            }
        }

        try {
            const requestBody: Record<string, unknown> = {
                model: config.model,
                temperature: config.temperature ?? 0.2,
                messages: [
                    { role: 'system', content: prompt },
                    ...conversationHistory, // Include chat history
                    { role: 'user', content: text },
                ],
                response_format: { type: 'json_object' },
            };

            // Add max_tokens if configured
            if (agentSettings.maxOutputTokens) {
                requestBody.max_tokens = agentSettings.maxOutputTokens;
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error({ status: response.status, error: errorText }, 'OpenAI API error');
                return null;
            }

            const data = (await response.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };

            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                logger.error('OpenAI returned empty content');
                return null;
            }

            // Parse and validate JSON response
            let analysis = this.parseAnalysis(content);
            analysis.promptVariantId = variantId;

            // Check forbidden phrases AFTER getting response
            const forbidden = agentSettings.forbiddenPhrases ?? [];
            if (forbidden.length > 0 && analysis.suggestedReply && this.containsTrigger(analysis.suggestedReply, forbidden)) {
                logger.warn({ patientId }, 'Forbidden phrase detected in AI response, forcing handoff');
                analysis = {
                    ...analysis,
                    shouldReply: false,
                    handoffRequired: true,
                    riskLevel: 'MEDIUM',
                    suggestedReply: undefined,
                };
            }

            // Post-process suggestedReply
            if (analysis.suggestedReply) {
                analysis.suggestedReply = this.postProcessSuggestedReply(
                    analysis.suggestedReply,
                    agentSettings.maxSentences ?? 6,
                    1200 // maxChars
                );
            }

            // Trigger Task Creation (Synchronous)
            try {
                if (analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL') {
                    await taskService.createTask({
                        patientId,
                        type: TaskType.RISK_ALERT,
                        priority: TaskPriority.HIGH,
                        title: 'Тревожный сигнал от пациента (AI)',
                        description: `AI обнаружил высокий риск: ${analysis.riskLevel}. Summary: ${analysis.summary}`,
                        source: TaskSource.AI,
                        meta: { riskLevel: analysis.riskLevel, summary: analysis.summary }
                    });
                } else if (analysis.handoffRequired) {
                    await taskService.createTask({
                        patientId,
                        type: TaskType.FOLLOW_UP,
                        priority: TaskPriority.MEDIUM,
                        title: 'Пациент просит человека (AI)',
                        description: `Запрос на переключение оператора. Summary: ${analysis.summary}`,
                        source: TaskSource.AI,
                        meta: { summary: analysis.summary }
                    });
                }
            } catch (taskError) {
                logger.error({ error: taskError, patientId }, 'Failed to create AI task');
            }

            // Enhanced logging
            logger.info(
                {
                    patientId,
                    riskLevel: analysis.riskLevel,
                    shouldReply: analysis.shouldReply,
                    handoffRequired: analysis.handoffRequired,
                    variantId,
                    extractedCheckIns: analysis.extractedCheckIns?.length ?? 0,
                },
                'AI analysis completed'
            );

            await systemLogService.create('INFO', 'AI', 'Analysis completed', {
                patientId,
                risk: analysis.riskLevel,
                reply: analysis.shouldReply,
                variantId,
                extractedCheckIns: analysis.extractedCheckIns?.length ?? 0,
            });

            // Auto-save extracted check-ins to database
            if (analysis.extractedCheckIns && analysis.extractedCheckIns.length > 0) {
                await this.saveExtractedCheckIns(patientId, analysis.extractedCheckIns);
            }

            return analysis;
        } catch (error) {
            logger.error({ error, patientId }, 'AI analysis error');
            await systemLogService.create('ERROR', 'AI', 'Analysis Failed', { error: (error as Error).message });
            return null;
        }
    }



    /**
     * Post-process suggestedReply to enforce maxSentences and maxChars
     * Guarantees consistent UX even if LLM generates too much
     */
    private postProcessSuggestedReply(text: string, maxSentences: number, maxChars: number): string {
        let result = text.trim();

        // Truncate by max chars first
        if (result.length > maxChars) {
            result = result.substring(0, maxChars);
            // Try to end at last complete sentence
            const lastSentenceEnd = Math.max(
                result.lastIndexOf('.'),
                result.lastIndexOf('!'),
                result.lastIndexOf('?')
            );
            if (lastSentenceEnd > maxChars * 0.5) {
                result = result.substring(0, lastSentenceEnd + 1);
            } else {
                result = result + '...';
            }
        }

        // Truncate by max sentences
        const sentences = result.split(/(?<=[.!?])\s+/);
        if (sentences.length > maxSentences) {
            result = sentences.slice(0, maxSentences).join(' ');
        }

        return result.trim();
    }

    /**
     * Toggle AI pause status for a patient
     */
    async togglePatientAI(patientId: string, pause: boolean, staffId?: string, reason?: string): Promise<void> {
        await prisma.patient.update({
            where: { id: patientId },
            data: {
                aiPaused: pause,
                aiPausedAt: pause ? new Date() : null,
                aiPausedBy: pause ? (staffId ?? 'staff') : null,
                aiPauseReason: pause ? reason : null,
            },
        });
        logger.info({ patientId, aiPaused: pause, staffId }, 'Patient AI status toggled');
    }

    /**
     * Get AI pause status for a patient
     */
    async getPatientAIStatus(patientId: string): Promise<{ aiPaused: boolean; aiPausedAt?: Date; aiPausedBy?: string }> {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { aiPaused: true, aiPausedAt: true, aiPausedBy: true }
        });
        return {
            aiPaused: patient?.aiPaused ?? false,
            aiPausedAt: patient?.aiPausedAt ?? undefined,
            aiPausedBy: patient?.aiPausedBy ?? undefined,
        };
    }

    /**
     * Parse and validate AI response
     */
    private parseAnalysis(content: string): AIAnalysisResult {
        try {
            const parsed = JSON.parse(content);

            return {
                sentiment: this.validateSentiment(parsed.sentiment),
                enhancedSentiment: this.parseEnhancedSentiment(parsed.enhancedSentiment),
                intent: this.validateIntent(parsed.intent),
                riskLevel: this.validateRiskLevel(parsed.riskLevel),
                summary: String(parsed.summary || 'No summary'),
                shouldReply: Boolean(parsed.shouldReply),
                suggestedReply: parsed.suggestedReply ? String(parsed.suggestedReply) : undefined,
                handoffRequired: Boolean(parsed.handoffRequired),
                checkInSatisfied: Boolean(parsed.checkInSatisfied),
                extractedCheckIns: this.parseExtractedCheckIns(parsed.extractedCheckIns),
            };
        } catch (error) {
            logger.error({ error, content }, 'Failed to parse AI response');
            return {
                sentiment: 'neutral',
                riskLevel: 'MEDIUM',
                summary: 'Failed to analyze',
                shouldReply: false,
                handoffRequired: true,
            };
        }
    }

    /**
     * Parse and validate extracted check-ins from AI response
     */
    private parseExtractedCheckIns(value: unknown): ExtractedCheckIn[] | undefined {
        if (!value || !Array.isArray(value)) return undefined;

        const validTypes = ['WEIGHT', 'STEPS', 'MOOD', 'DIET_ADHERENCE', 'SLEEP', 'WATER', 'FOOD_LOG', 'EXERCISE', 'FREE_TEXT'];
        const validConfidence = ['high', 'medium', 'low'];

        const checkIns: ExtractedCheckIn[] = [];

        for (const item of value) {
            if (!item || typeof item !== 'object') continue;
            if (!item.type || !validTypes.includes(item.type)) continue;

            checkIns.push({
                type: item.type,
                valueNumber: typeof item.valueNumber === 'number' ? item.valueNumber : undefined,
                valueText: typeof item.valueText === 'string' ? item.valueText : undefined,
                valueBool: typeof item.valueBool === 'boolean' ? item.valueBool : undefined,
                confidence: validConfidence.includes(item.confidence) ? item.confidence : 'medium',
            });
        }

        return checkIns.length > 0 ? checkIns : undefined;
    }

    /**
     * Save extracted check-ins to database
     */
    async saveExtractedCheckIns(patientId: string, checkIns: ExtractedCheckIn[]): Promise<void> {
        if (!checkIns || checkIns.length === 0) return;

        // Map AI types to Prisma CheckInType (only valid ones)
        const prismaTypeMap: Record<string, string> = {
            'WEIGHT': 'WEIGHT',
            'STEPS': 'STEPS',
            'MOOD': 'MOOD',
            'DIET_ADHERENCE': 'DIET_ADHERENCE',
            'SLEEP': 'SLEEP',
            'FREE_TEXT': 'FREE_TEXT',
            'FOOD_LOG': 'FREE_TEXT',  // Map to FREE_TEXT
            'WATER': 'FREE_TEXT',     // Map to FREE_TEXT (add note)
            'EXERCISE': 'FREE_TEXT',  // Map to FREE_TEXT
        };

        for (const checkIn of checkIns) {
            const prismaType = prismaTypeMap[checkIn.type];
            if (!prismaType) continue;

            try {
                await prisma.checkIn.create({
                    data: {
                        patientId,
                        type: prismaType as any,
                        valueNumber: checkIn.valueNumber,
                        valueText: checkIn.valueText || (checkIn.type !== prismaType ? `[${checkIn.type}] ${checkIn.valueText || ''}` : undefined),
                        valueBool: checkIn.valueBool,
                        source: CheckInSource.AI,
                    },
                });
                logger.info({ patientId, type: checkIn.type, value: checkIn.valueNumber ?? checkIn.valueText }, 'Auto-saved check-in from message');
            } catch (err) {
                logger.error({ err, patientId, checkIn }, 'Failed to save extracted check-in');
            }
        }
    }

    private validateSentiment(value: unknown): 'positive' | 'neutral' | 'negative' {
        if (value === 'positive' || value === 'neutral' || value === 'negative') {
            return value;
        }
        return 'neutral';
    }

    private validateIntent(value: unknown): 'question' | 'complaint' | 'checkin' | 'urgent' | 'chitchat' | 'gratitude' | 'unknown' {
        const validIntents = ['question', 'complaint', 'checkin', 'urgent', 'chitchat', 'gratitude', 'unknown'];
        if (typeof value === 'string' && validIntents.includes(value)) {
            return value as 'question' | 'complaint' | 'checkin' | 'urgent' | 'chitchat' | 'gratitude' | 'unknown';
        }
        return 'unknown';
    }

    private parseEnhancedSentiment(value: unknown): { overall: 'positive' | 'neutral' | 'negative'; emotions: ('anxious' | 'frustrated' | 'hopeful' | 'confused' | 'calm' | 'grateful' | 'discouraged')[]; intensity: 'low' | 'medium' | 'high' } | undefined {
        if (!value || typeof value !== 'object') return undefined;
        const obj = value as Record<string, unknown>;
        const validEmotions = ['anxious', 'frustrated', 'hopeful', 'confused', 'calm', 'grateful', 'discouraged'] as const;
        const emotions = Array.isArray(obj.emotions)
            ? obj.emotions.filter((e): e is typeof validEmotions[number] => validEmotions.includes(e as typeof validEmotions[number]))
            : [];
        return {
            overall: this.validateSentiment(obj.overall),
            emotions,
            intensity: ['low', 'medium', 'high'].includes(obj.intensity as string) ? (obj.intensity as 'low' | 'medium' | 'high') : 'medium'
        };
    }

    private validateRiskLevel(value: unknown): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL') {
            return value;
        }
        return 'MEDIUM';
    }
    async generateCheckInSummary(
        patientId: string,
        checkIns: any[] // Using any[] to avoid circular dependency issues for now, or import CheckIn type if safe
    ): Promise<{
        progress: string;
        issues: string[];
        nextStep: string;
        tone: 'encouraging' | 'neutral' | 'concerned';
    }> {
        const config = await this.getConfig();
        if (!config) {
            return {
                progress: 'AI not configured',
                issues: [],
                nextStep: 'Check in manually',
                tone: 'neutral',
            };
        }

        const context = checkIns.map(c =>
            `- ${new Date(c.createdAt).toLocaleDateString()}: [${c.type}] ${c.valueText || c.valueNumber || (c.valueBool ? 'Yes' : 'No')}`
        ).join('\n');

        const prompt = `
        Analyze the following recent patient check-ins and generate a summary.
        
        Check-ins:
        ${context}

        Return JSON format:
        {
            "progress": "Brief summary of progress (1-2 sentences)",
            "issues": ["List of potential issues or areas of concern"],
            "nextStep": "One clear actionable next step for the patient",
            "tone": "encouraging" | "neutral" | "concerned"
        }
        `;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                }),
            });

            if (!response.ok) throw new Error('AI request failed');

            const data = (await response.json()) as { choices: { message: { content: string } }[] };
            const content = data.choices[0].message.content;
            return JSON.parse(content);
        } catch (error) {
            logger.error({ error, patientId }, 'Failed to generate check-in summary');
            return {
                progress: 'Unable to generate summary',
                issues: ['AI service error'],
                nextStep: 'Contact support',
                tone: 'neutral',
            };
        }
    }
    async transcribeAudio(audioUrl: string): Promise<string | null> {
        const config = await this.getConfig();
        if (!config) return null;

        try {
            // Fetch audio file
            const audioRes = await fetch(audioUrl);
            if (!audioRes.ok) {
                logger.warn({ audioUrl, status: audioRes.status }, 'Failed to fetch audio for transcription');
                return null;
            }

            const arrayBuffer = await audioRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Create a File-like object for FormData
            // In Node 20, global File exists, but let's be robust
            const blob = new Blob([buffer], { type: 'audio/ogg' });
            const file = new File([blob], 'audio.ogg', { type: 'audio/ogg' });

            const formData = new FormData();
            formData.append('file', file);
            formData.append('model', 'whisper-1');

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.apiKey}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const err = await response.text();
                logger.error({ error: err }, 'Whisper API failed');
                return null;
            }

            const data = await response.json() as { text: string };
            logger.info({ text: data.text }, 'Audio transcription completed');
            return data.text;
        } catch (error) {
            logger.error({ error }, 'Audio transcription error');
            return null;
        }
    }

    /**
     * Analyze image using GPT-4 Vision (food photos, scale, step counter)
     */
    async analyzeImage(imageUrl: string, patientId: string): Promise<ImageAnalysisResult | null> {
        const config = await this.getConfig();
        if (!config) {
            logger.warn('AI not configured, skipping image analysis');
            return null;
        }

        const visionPrompt = `Ты — ИИ-куратор программы снижения веса. Проанализируй это изображение.

Определи тип изображения:
1. FOOD — фото еды
2. SCALE — фото весов с показаниями веса
3. STEPS — скриншот шагомера с количеством шагов
4. OTHER — другое изображение

=== ЕСЛИ ЭТО ФОТО ЕДЫ ===
- Распознай все продукты на фото
- Оцени примерные калории каждого продукта и итого
- Дай оценку приёма пищи: excellent/good/moderate/needs_improvement
- Напиши тёплый, поддерживающий комментарий (1-2 предложения)

=== ЕСЛИ ЭТО СКРИНШОТ ВЕСОВ/ШАГОМЕРА ===
- Извлеки числовое значение (вес в кг или количество шагов)
- Напиши ободряющий комментарий

=== ЕСЛИ ЭТО ДРУГОЕ ФОТО ===
- Опиши что на фото
- Вежливо спроси, что пациент хотел показать

Ответ в JSON:
{
    "imageType": "food" | "scale" | "steps" | "other",
    "foods": [{ "name": "...", "portion": "...", "caloriesEstimate": 123 }],
    "totalCalories": 456,
    "mealAssessment": "good",
    "suggestion": "Совет по улучшению, если нужно",
    "extractedValue": 72.5,
    "description": "Описание для other",
    "response": "Тёплый ответ пациенту"
}`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o', // Vision model
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: visionPrompt },
                                { type: 'image_url', image_url: { url: imageUrl } }
                            ]
                        }
                    ],
                    response_format: { type: 'json_object' },
                    max_tokens: 1000,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error({ status: response.status, error: errorText }, 'Vision API error');
                return null;
            }

            const data = (await response.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };

            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                logger.error('Vision API returned empty content');
                return null;
            }

            const parsed = JSON.parse(content) as ImageAnalysisResult;

            // Auto-save check-in based on image type
            if (parsed.imageType === 'scale' && parsed.extractedValue) {
                await this.saveExtractedCheckIns(patientId, [{
                    type: 'WEIGHT',
                    valueNumber: parsed.extractedValue,
                    confidence: 'high'
                }]);
            } else if (parsed.imageType === 'steps' && parsed.extractedValue) {
                await this.saveExtractedCheckIns(patientId, [{
                    type: 'STEPS',
                    valueNumber: parsed.extractedValue,
                    confidence: 'high'
                }]);
            } else if (parsed.imageType === 'food' && parsed.foods) {
                const foodDesc = parsed.foods.map(f => f.name).join(', ');
                await this.saveExtractedCheckIns(patientId, [{
                    type: 'FOOD_LOG',
                    valueText: `${foodDesc} (~${parsed.totalCalories} ккал)`,
                    confidence: 'medium'
                }]);
            }

            logger.info({ patientId, imageType: parsed.imageType, totalCalories: parsed.totalCalories }, 'Image analysis completed');

            return parsed;
        } catch (error) {
            logger.error({ error, patientId }, 'Image analysis error');
            return null;
        }
    }


}

// Singleton instance
export const aiService = new AIService();
