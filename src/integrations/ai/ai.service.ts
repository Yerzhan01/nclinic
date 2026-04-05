import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import { taskService } from '@/modules/tasks/task.service.js';
import { TaskType, TaskPriority, TaskSource, CheckInSource } from '@prisma/client';
import type { CheckInType } from '@prisma/client';
import type { AIConfig, AIAnalysisResult, AIConnectionStatus, ExtractedCheckIn, ImageAnalysisResult } from './ai.types.js';
import { DEFAULT_AGENT_SETTINGS } from './ai.types.js';
import { systemLogService } from '@/modules/system/system-log.service.js';
import { aiPromptBuilder } from './ai.prompt.builder.js';
import { buildPatientContext as _buildPatientContext } from '@/common/utils/buildPatientContext.js';
import type { PatientProfile } from '@/modules/patients/patient-profile.schema.js';

// Max context length to prevent token overflow
const _MAX_CONTEXT_LENGTH = 1200;

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

        const raw = settings.config as Record<string, unknown>;
        const config = raw as unknown as AIConfig;

        // Inject env var if key is missing in DB
        if (!config.apiKey && process.env.OPENAI_API_KEY) {
            config.apiKey = process.env.OPENAI_API_KEY;
        }

        // Migrate legacy flat format → nested agent format
        // Old DB had: { systemPrompt, maxTokens, ... }
        // New format expects: { agent: { systemPromptBase, maxOutputTokens, ... } }
        if (!config.agent) {
            config.agent = {};
        }
        if (!config.agent.systemPromptBase && typeof raw.systemPrompt === 'string') {
            config.agent.systemPromptBase = raw.systemPrompt as string;
        }
        if (!config.agent.maxOutputTokens && typeof raw.maxTokens === 'number') {
            config.agent.maxOutputTokens = raw.maxTokens as number;
        }

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
            apiKey: partial.apiKey ?? current?.apiKey ?? process.env.OPENAI_API_KEY ?? '',
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
     * Helper for robust API calls with retry logic (Exponential Backoff)
     */
    private async fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
        let lastError: Error | null = null;

        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);

                // If success or client error (400-401), return immediately
                // We only retry on 429 (Rate Limit) or 5xx (Server Error)
                if (response.ok || (response.status >= 400 && response.status < 429)) {
                    return response;
                }

                if (response.status === 429 || response.status >= 500) {
                    const errorText = await response.text();
                    throw new Error(`API Error ${response.status}: ${errorText}`);
                }

                return response;
            } catch (error) {
                lastError = error as Error;
                const isLastAttempt = i === retries - 1;

                if (!isLastAttempt) {
                    // Backoff: 1s, 2s, 4s...
                    const delay = Math.pow(2, i) * 1000;
                    logger.warn({ attempt: i + 1, error: lastError.message }, `OpenAI call failed, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('API request failed after retries');
    }

    /**
     * Test connection to OpenAI
     */
    private async testConnection(config: AIConfig): Promise<void> {
        const response = await this.fetchWithRetry('https://api.openai.com/v1/models', {
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
    async analyzeMessage(text: string, patientId: string, context?: string): Promise<AIAnalysisResult | null> {
        const config = await this.getConfig();

        if (!config) {
            logger.warn('AI not configured, skipping analysis');
            return null;
        }

        const agentSettings = config.agent ?? DEFAULT_AGENT_SETTINGS;

        // Check handoff triggers BEFORE calling OpenAI (fast path)
        // Only check the USER'S text, not the system-appended context
        // Check handoff triggers BEFORE calling OpenAI (fast path)
        // Only check the USER'S text, not the system-appended context
        const triggers = agentSettings.handoffTriggers ?? DEFAULT_AGENT_SETTINGS.handoffTriggers ?? [];
        let forceHandoff = false;

        if (triggers.length > 0 && this.containsTrigger(text, triggers)) {
            logger.info({ patientId, triggers }, 'Handoff trigger detected, forcing handoff');
            forceHandoff = true;
            // We NO LONGER return early. We let the AI generate a polite "I'm passing this to a doctor" reply.
            // The prompt will handle the wording.
        }

        // Fetch recent messages for prompt builder
        const recentMessages = await prisma.message.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' }, // Fetch NEWEST first
            take: 50 // Increase context window
        });

        // Reverse to chronological order (Oldest -> Newest) for the LLM
        recentMessages.reverse();

        const promptResult = await aiPromptBuilder.buildPrompt(patientId, recentMessages);

        // If no system prompt is configured, AI should not reply
        if (!promptResult) {
            logger.warn({ patientId }, 'AI prompt not configured — skipping reply');
            return {
                sentiment: 'neutral',
                riskLevel: 'LOW',
                summary: 'AI prompt not configured',
                shouldReply: false,
                handoffRequired: false,
            };
        }

        const { prompt, variantId } = promptResult;

        // Build conversation history for context (expanded to last 40 messages for better memory)
        const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        const historyMessages = recentMessages.slice(-40); // Last 40 messages from the NEWEST batch

        for (const msg of historyMessages) {
            if (msg.content) {
                const role = msg.sender === 'PATIENT' ? 'user' : 'assistant';
                conversationHistory.push({ role, content: msg.content });
            }
        }

        // Combine text with context for the LLM (if present)
        const fullContent = context ? `${text}\n\n[Context]: ${context}` : text;

        try {
            const requestBody: Record<string, unknown> = {
                model: config.model,
                temperature: config.temperature ?? 0.2,
                messages: [
                    { role: 'system', content: prompt },
                    ...conversationHistory, // Include chat history
                    { role: 'user', content: fullContent },
                ],
                response_format: { type: 'json_object' },
            };

            // Use max_completion_tokens (OpenAI deprecated max_tokens for newer models)
            // Minimum 1500 to avoid truncation with enriched JSON response format
            const outputTokens = Math.max(agentSettings.maxOutputTokens ?? 1500, 1500);
            requestBody.max_completion_tokens = outputTokens;

            logger.info({
                model: config.model,
                messageCount: (requestBody.messages as unknown[]).length,
                promptChars: JSON.stringify(requestBody.messages).length,
                maxCompletionTokens: requestBody.max_completion_tokens,
            }, 'Sending OpenAI request');

            const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
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

            logger.info({
                contentLength: content?.length ?? 0,
                contentPreview: content?.substring(0, 200),
                finishReason: (data.choices?.[0] as Record<string, unknown>)?.finish_reason,
            }, 'OpenAI response received');

            if (!content || !content.trim()) {
                logger.error({ contentRaw: JSON.stringify(content) }, 'OpenAI returned empty/whitespace content');
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

            // Apply forced handoff from triggers
            if (forceHandoff) {
                analysis.handoffRequired = true;
                analysis.riskLevel = (analysis.riskLevel === 'CRITICAL') ? 'CRITICAL' : 'HIGH';
                analysis.summary = `[TRIAGE] ${analysis.summary}`;
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
        if (!value || !Array.isArray(value)) { return undefined; }

        const validTypes = ['WEIGHT', 'STEPS', 'MOOD', 'DIET_ADHERENCE', 'SLEEP', 'WATER', 'FOOD_LOG', 'EXERCISE', 'FREE_TEXT'];
        const validConfidence = ['high', 'medium', 'low'];

        const checkIns: ExtractedCheckIn[] = [];

        for (const item of value) {
            if (!item || typeof item !== 'object') { continue; }
            if (!item.type || !validTypes.includes(item.type)) { continue; }

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
        if (!checkIns || checkIns.length === 0) { return; }

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
            if (!prismaType) { continue; }

            try {
                await prisma.checkIn.create({
                    data: {
                        patientId,
                        type: prismaType as CheckInType,
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
        if (!value || typeof value !== 'object') { return undefined; }
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
        checkIns: { createdAt: Date; type: string; valueText?: string | null; valueNumber?: number | null; valueBool?: boolean | null }[]
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
            const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
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

            if (!response.ok) { throw new Error('AI request failed'); }

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
        if (!config) { return null; }

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
            // Bilingual prompt hint helps Whisper recognize both Kazakh and Russian medical speech
            formData.append('prompt', 'Сәлеметсіз бе, менің салмағым, дәрігер, тамақ, диета, денсаулық. Здравствуйте, мой вес, доктор, питание, самочувствие.');

            const response = await this.fetchWithRetry('https://api.openai.com/v1/audio/transcriptions', {
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

        const visionPrompt = `Ты — строгий, но доброжелательный нутрициолог-куратор программы снижения веса. Проанализируй фото.

ЯЗЫК: Отвечай на том языке, на котором пациент общался (русский или қазақша). Если не ясно — на русском.

=== ОПРЕДЕЛИ ТИП ===
1. FOOD — фото еды/напитков
2. SCALE — показания весов
3. STEPS — скриншот шагомера
4. OTHER — другое

=== ФОТО ЕДЫ (КРИТИЧЕСКИ ВАЖНО) ===
- Распознай ВСЕ продукты точно (не угадывай — если видишь шоколад, пиши "шоколад", не "полезный батончик")
- Оцени калории каждого продукта и итого
- Дай ЧЕСТНУЮ оценку:
  * "excellent" — правильное питание, овощи, белок, клетчатка
  * "good" — в целом хорошо, мелкие замечания
  * "moderate" — нормально, но есть чем заменить
  * "needs_improvement" — сладости, фастфуд, чипсы, шоколад, газировка, выпечка
- В "response" дай КОНКРЕТНЫЙ совет:
  * Если еда здоровая — похвали и предложи дополнить (например, "добавь белок/овощи")
  * Если еда НЕздоровая — мягко, но ЧЕСТНО скажи: "Этот продукт содержит много сахара/жира. Для снижения веса лучше заменить на [конкретная альтернатива]"
  * НИКОГДА не говори "хороший выбор" на шоколад, чипсы, фастфуд или сладости!
- В "suggestion" — конкретная альтернатива (например "Вместо шоколадного батончика попробуй горький шоколад 70%+ или горсть орехов")
- НИКОГДА не повторяй один и тот же ответ дословно

=== ВЕСЫ / ШАГОМЕР ===
- Извлеки число (вес кг / шаги)
- Ободряющий комментарий

=== ДРУГОЕ ===
- Опиши что видишь
- Спроси, что пациент хотел показать

Ответ строго в формате json:
{
  "imageType": "food",
  "foods": [{ "name": "Название", "portion": "Порция", "caloriesEstimate": 123 }],
  "totalCalories": 456,
  "mealAssessment": "good",
  "suggestion": "Конкретный совет по замене или улучшению",
  "extractedValue": null,
  "description": "",
  "response": "Персонализированный ответ пациенту"
}`;

        // ============================================
        // BUILD RICH PATIENT CONTEXT FOR SMART RESPONSES
        // ============================================
        let patientIntelligence = '';
        try {
            // 1. Patient profile + active program
            const patient = await prisma.patient.findUnique({
                where: { id: patientId },
                select: {
                    fullName: true,
                    profile: true,
                    conversationSummary: true,
                    programs: {
                        where: { status: 'ACTIVE' },
                        include: { template: true },
                        take: 1,
                    },
                },
            });

            if (patient) {
                const parts: string[] = [];

                // Patient name
                parts.push(`\n=== ПАЦИЕНТ ===`);
                parts.push(`Имя: ${patient.fullName}`);

                // Profile (weight, goal, allergies, etc)
                const profile = patient.profile as PatientProfile | null;
                if (profile) {
                    if (profile.weightKg) { parts.push(`Текущий вес: ${profile.weightKg} кг`); }
                    if (profile.targetWeightKg) { parts.push(`Цель: ${profile.targetWeightKg} кг`); }
                    if (profile.heightCm) { parts.push(`Рост: ${profile.heightCm} см`); }
                    if (profile.nutritionPlan?.kcalTarget) {
                        parts.push(`Норма калорий: ${profile.nutritionPlan.kcalTarget} ккал/день`);
                    }
                    if (profile.allergies?.length) {
                        parts.push(`⚠️ Аллергии: ${profile.allergies.join(', ')}`);
                    }
                    if (profile.nutritionPlan?.restrictions?.length) {
                        parts.push(`Ограничения: ${profile.nutritionPlan.restrictions.join(', ')}`);
                    }
                }

                // Program day
                if (patient.programs[0]) {
                    const prog = patient.programs[0];
                    const dayNum = Math.ceil((Date.now() - prog.startDate.getTime()) / (1000 * 60 * 60 * 24));
                    parts.push(`Программа: ${prog.template.name}, день ${dayNum} из ${prog.template.durationDays}`);
                }

                // 2. Weight trend (last 7 weight check-ins)
                const weightCheckIns = await prisma.checkIn.findMany({
                    where: { patientId, type: 'WEIGHT', valueNumber: { not: null } },
                    orderBy: { createdAt: 'desc' },
                    take: 7,
                    select: { valueNumber: true, createdAt: true },
                });

                if (weightCheckIns.length >= 2) {
                    const trend = weightCheckIns.reverse();
                    const weights = trend.map(c => c.valueNumber!);
                    const diff = weights[weights.length - 1] - weights[0];
                    const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
                    parts.push(`\n=== ДИНАМИКА ВЕСА ===`);
                    parts.push(`${weights.map(w => w.toFixed(1)).join(' → ')} кг (${diffStr} кг)`);
                }

                // 3. Today's meals (from check-ins)
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                const todayFoodCheckIns = await prisma.checkIn.findMany({
                    where: {
                        patientId,
                        type: 'DIET_ADHERENCE',
                        createdAt: { gte: todayStart },
                    },
                    orderBy: { createdAt: 'asc' },
                    select: { valueText: true, createdAt: true },
                });

                // Also check today's AI food responses from messages
                const todayFoodMessages = await prisma.message.findMany({
                    where: {
                        patientId,
                        sender: 'AI',
                        createdAt: { gte: todayStart },
                        content: { contains: 'ккал' },
                    },
                    orderBy: { createdAt: 'asc' },
                    take: 5,
                    select: { content: true, createdAt: true },
                });

                if (todayFoodCheckIns.length > 0 || todayFoodMessages.length > 0) {
                    parts.push(`\n=== ЕДА СЕГОДНЯ ===`);
                    for (const ci of todayFoodCheckIns) {
                        const time = ci.createdAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });
                        parts.push(`${time}: ${ci.valueText || 'фото еды'}`);
                    }
                    if (todayFoodMessages.length > 0) {
                        parts.push(`(Уже ${todayFoodMessages.length} приём(ов) пищи проанализировано сегодня)`);
                    }
                }

                // Time of day → meal type
                const almatyHour = new Date().getUTCHours() + 5; // UTC+5
                let mealType = 'перекус';
                if (almatyHour >= 6 && almatyHour < 11) { mealType = 'завтрак'; }
                else if (almatyHour >= 11 && almatyHour < 15) { mealType = 'обед'; }
                else if (almatyHour >= 15 && almatyHour < 18) { mealType = 'полдник'; }
                else if (almatyHour >= 18 && almatyHour < 22) { mealType = 'ужин'; }
                parts.push(`Вероятный приём пищи: ${mealType}`);

                // 4. Emotional intelligence — recent sentiment from messages
                const recentPatientMsgs = await prisma.message.findMany({
                    where: { patientId, sender: 'PATIENT', content: { not: null } },
                    orderBy: { createdAt: 'desc' },
                    take: 15,
                    select: { content: true },
                });

                if (recentPatientMsgs.length > 3) {
                    const negativeWords = ['плохо', 'сорвал', 'срыв', 'устал', 'грустно', 'не могу', 'тяжело', 'бросить', 'надоело', 'жалуюсь', 'не получается', 'нет сил'];
                    const positiveWords = ['хорошо', 'отлично', 'супер', 'рада', 'доволь', 'получилось', 'ура', 'прогресс', 'молодец', 'спасибо', 'класс'];

                    let negCount = 0;
                    let posCount = 0;
                    for (const msg of recentPatientMsgs) {
                        const lower = (msg.content || '').toLowerCase();
                        if (negativeWords.some(w => lower.includes(w))) { negCount++; }
                        if (positiveWords.some(w => lower.includes(w))) { posCount++; }
                    }

                    parts.push(`\n=== ЭМОЦИОНАЛЬНЫЙ ФОН ===`);
                    if (negCount > posCount && negCount >= 2) {
                        parts.push(`Пациент проявляет признаки усталости/разочарования. Будь особенно мягким и поддерживающим. НЕ критикуй.`);
                    } else if (posCount > negCount) {
                        parts.push(`Пациент в хорошем настроении. Можно быть энергичным и мотивирующим.`);
                    } else {
                        parts.push(`Нейтральный тон. Будь дружелюбным и профессиональным.`);
                    }
                }

                // 5. Conversation summary (long-term memory)
                if (patient.conversationSummary) {
                    parts.push(`\n=== ДОЛГОВРЕМЕННАЯ ПАМЯТЬ ===`);
                    parts.push(patient.conversationSummary);
                }

                // 6. Chat history (anti-repetition & context for Vision)
                const recentMessages = await prisma.message.findMany({
                    where: { patientId, sender: { in: ['AI', 'PATIENT'] } },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: { sender: true, content: true },
                });
                if (recentMessages.length > 0) {
                    const history = recentMessages.reverse().map(m =>
                        `${m.sender === 'AI' ? 'Ты' : 'Пациент'}: ${m.content?.slice(0, 80) || '[медиа]'}`
                    ).join('\n');
                    parts.push(`\n=== ПОСЛЕДНИЕ СООБЩЕНИЯ ===`);
                    parts.push(history);
                    parts.push(`\nВАЖНО: НЕ повторяй свои предыдущие ответы! Используй другие формулировки.`);
                }

                // Обращайся к пациенту по имени
                const firstName = patient.fullName.split(' ')[0];
                parts.push(`\nОбращайся к пациенту по имени: ${firstName}`);

                patientIntelligence = parts.join('\n');
            }
        } catch (err) {
            logger.warn({ err }, 'Failed to build patient intelligence for Vision, proceeding without');
        }

        try {
            const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.apiKey} `,
                },
                body: JSON.stringify({
                    model: 'gpt-4o', // Vision model
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: visionPrompt + patientIntelligence },
                                { type: 'image_url', image_url: { url: imageUrl } }
                            ]
                        }
                    ],
                    response_format: { type: 'json_object' },
                    max_completion_tokens: 1000,
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
