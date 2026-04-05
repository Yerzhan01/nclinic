import { MessageDirection, MessageSender, ChatMode } from '@prisma/client';
import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import { AppError } from '@/common/errors/AppError.js';
import { whatsAppService } from '@/integrations/whatsapp/whatsapp.service.js';
import { aiService } from '@/integrations/ai/ai.service.js';
import type { AIAnalysisResult } from '@/integrations/ai/ai.types.js';
import { webSocketService } from '@/common/services/websocket.service.js';
import type { SaveInboundMessageInput, MessageDto } from './message.types.js';
import { redis } from '@/config/redis.js';
import { scheduleAIAnalysis } from '@/integrations/ai/ai.queue.js';
import { programService } from '@/modules/programs/program.service.js';
import { aiSummaryService } from '@/integrations/ai/ai.summary.service.js';
import { aiQualityService } from '@/integrations/ai/ai.quality.service.js';
import { aiABTestService } from '@/integrations/ai/ai.ab-test.service.js';
import { isAiCommand, parseAiCommand } from '@/common/utils/aiCommand.utils.js';

export class MessageService {
    /**
     * Save inbound message from WhatsApp, analyze with AI, and auto-reply if appropriate
     */
    async saveInboundMessage(input: SaveInboundMessageInput): Promise<MessageDto | null> {
        let { phone, text, mediaUrl, whatsappMessageId, timestamp: _timestamp } = input;

        // Idempotency check: Ignore if we already processed this message ID
        if (whatsappMessageId) {
            const existing = await prisma.message.findFirst({
                where: { whatsappMessageId }
            });
            if (existing) {
                logger.info({ whatsappMessageId }, 'Duplicate inbound message ignored (idempotency)');
                return null;
            }
        }

        // Audio Transcription Logic
        if (mediaUrl) {
            const ext = mediaUrl.split('.').pop()?.toLowerCase();
            const AUDIO_EXTENSIONS = ['ogg', 'mp3', 'wav', 'm4a', 'oga'];

            if (ext && AUDIO_EXTENSIONS.includes(ext)) {
                logger.info({ mediaUrl }, 'Audio message detected, attempting transcription');
                const transcription = await aiService.transcribeAudio(mediaUrl);

                if (transcription) {
                    text = (text ? text + '\n' : '') + `🎤 [Аудио]: ${transcription}`;
                    logger.info({ transcription }, 'Transcription added to message');
                }
            }
        }

        // Normalize phone
        const normalizedPhone = this.normalizePhone(phone);

        logger.info({
            raw: phone,
            normalized: normalizedPhone,
            plusVariant: '+' + normalizedPhone
        }, 'Searching for patient by phone (DEBUG)');

        // Find patient by phone (try both variants: 777... and +777...)
        const patient = await prisma.patient.findFirst({
            where: {
                OR: [
                    { phone: normalizedPhone },
                    { phone: '+' + normalizedPhone }
                ]
            },
        });

        if (!patient) {
            logger.warn({ phone, normalizedPhone }, 'Inbound message from unknown phone, ignoring');
            return null;
        }

        // Create the message
        const message = await prisma.message.create({
            data: {
                patientId: patient.id,
                direction: MessageDirection.INBOUND,
                sender: MessageSender.PATIENT,
                content: text || null,
                mediaUrl: mediaUrl || null,
                mediaType: input.mediaType || null,
            },
        });

        // Ensure text is not empty for AI triggers if it's a media message
        if (!text && mediaUrl) {
            if (input.mediaType === 'image') {
                text = '[Фото от пациента]';
            } else if (input.mediaType === 'audio') {
                text = '[Аудио сообщение]';
            } else {
                text = '[Медиа файл]';
            }
        }

        // Vision API: Analyze image if present
        let imageAnalysis = null;
        let analysisContext = ''; // Separate context for AI

        if (mediaUrl && input.mediaType === 'image') {
            logger.info({ mediaUrl, patientId: patient.id }, 'Analyzing image with Vision API');
            imageAnalysis = await aiService.analyzeImage(mediaUrl, patient.id);

            if (imageAnalysis) {
                // Format detailed response based on image type
                if (imageAnalysis.imageType === 'food' && imageAnalysis.foods && imageAnalysis.foods.length > 0) {
                    // Food photo: Show products and calories
                    const foodList = imageAnalysis.foods
                        .map(f => `• ${f.name} ${f.portion ? `(${f.portion})` : ''} — ~${f.caloriesEstimate || '?'} ккал`)
                        .join('\n');

                    const assessment = {
                        'excellent': '🌟 Отличный выбор!',
                        'good': '👍 Хороший выбор!',
                        'moderate': '⚖️ Умеренно',
                        'needs_improvement': '💡 Можно улучшить'
                    }[imageAnalysis.mealAssessment || 'moderate'];

                    analysisContext = `📋 Анализ приёма пищи:\n${foodList}\n\n🔢 Итого: ~${imageAnalysis.totalCalories || 0} ккал\n${assessment}\n\n${imageAnalysis.suggestion || imageAnalysis.response || ''}`;
                } else if (imageAnalysis.imageType === 'scale' && imageAnalysis.extractedValue) {
                    // Scale photo
                    analysisContext = `⚖️ Вес: ${imageAnalysis.extractedValue} кг\n${imageAnalysis.response || 'Записано!'}`;
                } else if (imageAnalysis.imageType === 'steps' && imageAnalysis.extractedValue) {
                    // Steps photo
                    analysisContext = `👟 Шаги: ${imageAnalysis.extractedValue}\n${imageAnalysis.response || 'Отличная активность!'}`;
                } else {
                    // Other
                    analysisContext = imageAnalysis.response ||
                        `[Анализ фото: ${imageAnalysis.imageType}, ${imageAnalysis.description || ''}]`;
                }

                // Append camera icon for context clearly
                analysisContext = `📷 ${analysisContext}`;

                logger.info({ imageType: imageAnalysis.imageType, totalCalories: imageAnalysis.totalCalories }, 'Image analysis completed');
            }
        }




        // Smart Check-in Linking
        let linkedCheckInId: string | null = null;

        // Check for pending activity
        try {
            const candidateActivity = await programService.findCandidateActivity(patient.id);

            if (candidateActivity) {
                // 1. Photos/Audio: Always trust media as proof
                if (mediaUrl) {
                    linkedCheckInId = await programService.createCheckIn(
                        patient.id,
                        candidateActivity.type,
                        (text || '[Media]') + (analysisContext ? `\n${analysisContext}` : ''), // Include analysis in check-in
                        'PATIENT'
                    );
                    logger.info({ linkedCheckInId, type: candidateActivity.type }, 'Auto-linked media to check-in');
                }
                // 2. Text: Wait for AI validation (handled in processAnalysisResult)
                else {
                    logger.info({ type: candidateActivity.type }, 'Candidate check-in found, awaiting AI validation');
                }
            }
        } catch (error) {
            logger.warn({ error, patientId: patient.id }, 'Failed to link check-in (Active Program missing?) - proceeding to save message');
        }


        // Update message with linkedCheckInId if found
        if (linkedCheckInId) {
            await prisma.message.update({
                where: { id: message.id },
                data: { linkedCheckInId },
            });
        }

        logger.info(
            { messageId: message.id, patientId: patient.id, linkedCheckInId, whatsappMessageId },
            'Inbound message saved'
        );

        // Update summary and check quality
        await aiSummaryService.checkAndUpdateSummary(patient.id);
        if (text) {
            void aiQualityService.analyzePatientReply(patient.id, { id: message.id, content: text });
        }

        // AI Analysis / Buffering
        // For image messages with successful Vision analysis: use Vision response directly
        // For text messages: pass through analyzeMessage() as usual
        const hasDirectVisionResponse = imageAnalysis &&
            ['food', 'scale', 'steps'].includes(imageAnalysis.imageType) &&
            analysisContext;

        if (hasDirectVisionResponse && patient.chatMode === ChatMode.AI && !patient.aiPaused) {
            // Vision API already produced a detailed, accurate response — send it directly
            // This avoids double-processing which caused generic/repetitive replies
            try {
                const visionReplyText = analysisContext.replace(/^📷\s*/, ''); // Remove camera prefix
                await this.sendVisionReply(patient.id, patient.phone, visionReplyText, message.id);
                logger.info({ patientId: patient.id, imageType: imageAnalysis!.imageType }, 'Sent direct Vision API reply');
            } catch (error) {
                logger.error({ error, patientId: patient.id }, 'Failed to send direct Vision reply, falling back to AI analysis');
                // Fallback to regular analysis
                const fullContent = text ? (text + '\n' + analysisContext) : analysisContext;
                await redis.rpush(`patient:${patient.id}:buffer`, fullContent);
                await scheduleAIAnalysis(patient.id, 10);
            }
        } else if ((text || analysisContext) && patient.chatMode === ChatMode.AI && !patient.aiPaused) {
            const config = await aiService.getConfig();
            const bufferSeconds = config?.messageBufferSeconds ?? 10;

            const fullContent = text ? (text + (analysisContext ? `\n${analysisContext}` : '')) : analysisContext;

            if (bufferSeconds > 0) {
                await redis.rpush(`patient:${patient.id}:buffer`, fullContent);
                await scheduleAIAnalysis(patient.id, bufferSeconds);
                logger.info({ patientId: patient.id, bufferSeconds }, 'Message buffered for AI analysis');
            } else {
                await this.processAIAnalysis(patient.id, patient.phone, text || '[Media]', message.id, analysisContext);
            }
        }

        const messageDto = {
            id: message.id,
            patientId: message.patientId,
            direction: message.direction,
            sender: message.sender,
            content: message.content,
            mediaUrl: message.mediaUrl,
            mediaType: (message as Record<string, unknown>).mediaType as string,
            linkedCheckInId,
            createdAt: message.createdAt,
        };

        webSocketService.broadcast('NEW_MESSAGE', messageDto);
        return messageDto;
    }

    /**
     * Process AI analysis result (Send reply, create alert, etc.)
     * Public to be used by AI Worker
     */
    async processAnalysisResult(patientId: string, analysis: AIAnalysisResult, messageId?: string): Promise<void> {
        // Import alertService dynamically to avoid circular dependency
        const { alertService } = await import('@/modules/alerts/alert.service.js');
        const { AlertType, AlertLevel } = await import('@prisma/client');

        try {
            logger.info(
                {
                    patientId,
                    riskLevel: analysis.riskLevel,
                    shouldReply: analysis.shouldReply,
                    handoffRequired: analysis.handoffRequired,
                    checkInSatisfied: analysis.checkInSatisfied
                },
                'AI analysis result'
            );

            // 0. Handle Check-in Validation
            if (analysis.checkInSatisfied) {
                const candidate = await programService.findCandidateActivity(patientId);
                if (candidate) {
                    const checkInId = await programService.createCheckIn(patientId, candidate.type, analysis.summary || 'AI Validated', 'AI');

                    // Link to original message if available
                    if (messageId) {
                        await prisma.message.update({
                            where: { id: messageId },
                            data: { linkedCheckInId: checkInId }
                        });
                    }

                    logger.info({ patientId, type: candidate.type, checkInId }, 'AI validated and created CheckIn');
                }
            }

            // Determine if handoff is needed (only CRITICAL or explicit handoffRequired)
            // HIGH risk creates alert but AI still replies
            const needsHandoff =
                analysis.handoffRequired ||
                analysis.riskLevel === 'CRITICAL';

            const needsAlert =
                needsHandoff ||
                analysis.riskLevel === 'HIGH';

            if (needsAlert) {
                // Create alert for staff visibility
                const alertType =
                    analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL'
                        ? AlertType.BAD_CONDITION
                        : AlertType.REQUEST_MANAGER;

                await alertService.createFromAI({
                    patientId,
                    messageId: messageId,
                    type: alertType,
                    level: AlertLevel[analysis.riskLevel as keyof typeof AlertLevel] || AlertLevel.MEDIUM,
                    title: `${needsHandoff ? 'AI Handoff' : 'AI Alert'}: ${analysis.summary.slice(0, 100)}`,
                    description: `Risk: ${analysis.riskLevel}\nSummary: ${analysis.summary}`,
                });

                logger.info(
                    { patientId, riskLevel: analysis.riskLevel, handoff: needsHandoff },
                    needsHandoff ? 'Handoff alert created - AI will NOT reply' : 'Alert created - AI will still reply'
                );
            }

            if (needsHandoff) {
                // Auto-reply for handoff if configured
                const config = await aiService.getConfig();
                const handoffResponse = config?.agent?.handoffResponse;

                if (handoffResponse) {
                    await this.sendSystemMessage(patientId, handoffResponse);
                    logger.info({ patientId }, 'Handoff auto-reply sent');
                }

                // Update A/B test metrics for handoff
                if (analysis.promptVariantId) {
                    await aiABTestService.updateVariantHandoffCount(analysis.promptVariantId);
                }

                // Do NOT send AI reply
                return;
            }

            // Only reply if LOW or MEDIUM risk and shouldReply is true
            if (analysis.shouldReply && analysis.suggestedReply) {
                // Fetch patient phone
                const patient = await prisma.patient.findUnique({
                    where: { id: patientId },
                    select: { phone: true }
                });

                if (!patient?.phone) {
                    logger.error({ patientId }, 'Cannot send AI reply: Patient phone not found');
                    return;
                }

                // Send via WhatsApp
                const result = await whatsAppService.sendMessage(patient.phone, analysis.suggestedReply);

                if (result.success) {
                    // Save AI message
                    const aiMessage = await prisma.message.create({
                        data: {
                            patientId,
                            direction: MessageDirection.OUTBOUND,
                            sender: MessageSender.AI,
                            content: analysis.suggestedReply,
                            promptVariantId: analysis.promptVariantId,
                            whatsappMessageId: result.whatsappMessageId, // Fix: Save ID to prevent duplication from webhook
                        },
                    });

                    // Update A/B test metrics
                    if (analysis.promptVariantId) {
                        await aiABTestService.updateVariantMessageCount(analysis.promptVariantId);
                    }

                    // Broadcast
                    webSocketService.broadcast('NEW_MESSAGE', {
                        id: aiMessage.id,
                        patientId: aiMessage.patientId,
                        direction: aiMessage.direction,
                        sender: aiMessage.sender,
                        content: aiMessage.content,
                        mediaUrl: aiMessage.mediaUrl,
                        mediaType: (aiMessage as Record<string, unknown>).mediaType as string,
                        createdAt: aiMessage.createdAt
                    });

                    logger.info({ patientId }, 'AI auto-reply sent');
                }
            }
        } catch (error) {
            logger.error({ error, patientId }, 'AI analysis processing error');
        }
    }

    /**
     * Send Vision API analysis directly as reply (for food/scale/steps photos)
     * Avoids double-processing through analyzeMessage which causes generic repetitive replies
     */
    private async sendVisionReply(
        patientId: string,
        phone: string,
        replyText: string,
        _messageId: string
    ): Promise<void> {
        const result = await whatsAppService.sendMessage(phone, replyText);

        if (result.success) {
            const aiMessage = await prisma.message.create({
                data: {
                    patientId,
                    direction: MessageDirection.OUTBOUND,
                    sender: MessageSender.AI,
                    content: replyText,
                    whatsappMessageId: result.whatsappMessageId,
                },
            });

            webSocketService.broadcast('NEW_MESSAGE', {
                id: aiMessage.id,
                patientId: aiMessage.patientId,
                direction: aiMessage.direction,
                sender: aiMessage.sender,
                content: aiMessage.content,
                mediaUrl: aiMessage.mediaUrl,
                mediaType: (aiMessage as Record<string, unknown>).mediaType,
                createdAt: aiMessage.createdAt,
            });

            logger.info({ patientId, messageId: aiMessage.id }, 'Vision reply sent directly');
        } else {
            logger.error({ patientId, phone }, 'Failed to send Vision reply via WhatsApp');
        }
    }

    /**
     * Process AI analysis and auto-reply if appropriate
     */
    private async processAIAnalysis(
        patientId: string,
        phone: string,
        text: string,
        messageId: string,
        context?: string // New separate context
    ): Promise<void> {
        try {
            // Pass context separated so trigger check only runs on 'text'
            const analysis = await aiService.analyzeMessage(text, patientId, context);

            if (!analysis) {
                // AI not configured or error - skip
                return;
            }

            await this.processAnalysisResult(patientId, analysis, messageId);

        } catch (error) {
            logger.error({ error, patientId }, 'AI analysis processing error');
            // Don't fail the whole message save on AI error
        }
    }

    /**
     * Send staff message to patient via WhatsApp
     */
    async sendStaffMessage(patientId: string, text: string): Promise<MessageDto> {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
        });

        if (!patient) {
            throw AppError.notFound('Patient not found');
        }

        // Send via WhatsApp
        const result = await whatsAppService.sendMessage(patient.phone, text);

        if (!result.success) {
            logger.warn({ patientId, phone: patient.phone }, 'WhatsApp send failed, saving message anyway');
        }

        // Save the message (include whatsappMessageId to prevent duplicates from outgoing webhook)
        const message = await prisma.message.create({
            data: {
                patientId,
                direction: MessageDirection.OUTBOUND,
                sender: MessageSender.STAFF,
                content: text,
                whatsappMessageId: result.whatsappMessageId || undefined,
            },
        });

        logger.info({ messageId: message.id, patientId }, 'Staff message sent and saved');

        const messageDto = {
            id: message.id,
            patientId: message.patientId,
            direction: message.direction,
            sender: message.sender,
            content: message.content,
            mediaUrl: message.mediaUrl,
            mediaType: (message as Record<string, unknown>).mediaType as string,
            linkedCheckInId: message.linkedCheckInId,
            createdAt: message.createdAt,
        };

        webSocketService.broadcast('NEW_MESSAGE', messageDto);
        return messageDto;
    }

    /**
     * Save synced message (sent from mobile)
     */
    async saveSyncedMessage(input: SaveInboundMessageInput): Promise<MessageDto | null> {
        let { phone, text, mediaUrl, whatsappMessageId, timestamp } = input;

        // Skip if message with this ID already exists
        const existing = await prisma.message.findFirst({
            where: { whatsappMessageId }
        });
        if (existing) { return null; }

        // Normalize phone
        const normalizedPhone = this.normalizePhone(phone);
        const patient = await prisma.patient.findFirst({
            where: {
                OR: [
                    { phone: normalizedPhone },
                    { phone: '+' + normalizedPhone }
                ]
            },
        });

        if (!patient) {
            // logger.warn({ phone }, 'Synced message for unknown phone, ignoring');
            return null;
        }

        // Create message
        const message = await prisma.message.create({
            data: {
                patientId: patient.id,
                direction: MessageDirection.OUTBOUND,
                sender: MessageSender.STAFF, // Assume generic staff for mobile sends
                content: text || (mediaUrl ? '[Медиа]' : null),
                mediaUrl: mediaUrl || null,
                mediaType: input.mediaType || null,
                whatsappMessageId,
                deliveryStatus: 'SENT', // It's already sent on phone
                createdAt: new Date(timestamp * 1000), // Use original timestamp
            },
        });

        // Check for AI commands (e.g. "#ai stop") sent from mobile
        if (text) {
            const config = await aiService.getConfig();
            const commandSettings = config?.agent?.commands;

            if (isAiCommand(text, commandSettings?.prefix)) {
                const { action } = parseAiCommand(text, commandSettings);

                if (action === 'pause') {
                    await aiService.togglePatientAI(patient.id, true, 'manager_mobile', text);
                    logger.info({ patientId: patient.id, text }, 'AI paused via mobile command');
                } else if (action === 'resume') {
                    await aiService.togglePatientAI(patient.id, false, 'manager_mobile', text);
                    logger.info({ patientId: patient.id, text }, 'AI resumed via mobile command');
                }
            }
        }

        const messageDto = {
            id: message.id,
            patientId: message.patientId,
            direction: message.direction,
            sender: message.sender,
            content: message.content,
            mediaUrl: message.mediaUrl,
            mediaType: (message as Record<string, unknown>).mediaType as string,
            linkedCheckInId: message.linkedCheckInId,
            createdAt: message.createdAt,
        };

        // Broadcast so it appears on UI
        webSocketService.broadcast('NEW_MESSAGE', messageDto);

        // Update summary so AI knows about this context
        await aiSummaryService.checkAndUpdateSummary(patient.id);

        return messageDto;
    }

    /**
     * Get messages for a patient
     */
    async getMessages(patientId: string, limit = 100): Promise<MessageDto[]> {
        const messages = await prisma.message.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' }, // Fetch NEWEST first
            take: limit,
        });

        // Reverse to return in chronological order (Oldest -> Newest) for the UI
        return messages.reverse().map((m) => ({
            id: m.id,
            patientId: m.patientId,
            direction: m.direction,
            sender: m.sender,
            content: m.content,
            mediaUrl: m.mediaUrl,
            mediaType: (m as Record<string, unknown>).mediaType as string,
            linkedCheckInId: m.linkedCheckInId,
            createdAt: m.createdAt,
        }));
    }

    /**
     * Try to link message to a pending CheckIn
     */
    private async tryLinkToCheckIn(
        _patientId: string,
        _timestamp: number,
        _messageId: string
    ): Promise<string | null> {
        // LEGACY: Link logic disabled in Phase 16
        return null;
    }

    /**
     * Determine slot based on message timestamp
     * MORNING: 05:00–11:59
     * AFTERNOON: 12:00–17:59
     * EVENING: 18:00–23:59
     */
    /*
    private determineSlot(_date: Date): Slot | null {
        // LEGACY: Disabled
        return null;
    }
    */

    /**
     * Send system message (reminder/notification) to patient via WhatsApp and save it
     */
    async sendSystemMessage(patientId: string, text: string): Promise<MessageDto> {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
        });

        if (!patient) {
            throw AppError.notFound('Patient not found');
        }

        // Send via WhatsApp
        const result = await whatsAppService.sendMessage(patient.phone, text);

        if (!result.success) {
            logger.warn({ patientId, phone: patient.phone }, 'WhatsApp send failed (System Message), saving anyway');
        }

        // Save the message (include whatsappMessageId to prevent duplicates from outgoing webhook)
        const message = await prisma.message.create({
            data: {
                patientId,
                direction: MessageDirection.OUTBOUND,
                sender: MessageSender.SYSTEM,
                content: text,
                whatsappMessageId: result.whatsappMessageId || undefined,
            },
        });

        logger.info({ messageId: message.id, patientId }, 'System message sent and saved');

        const messageDto = {
            id: message.id,
            patientId: message.patientId,
            direction: message.direction,
            sender: message.sender,
            content: message.content,
            mediaUrl: message.mediaUrl,
            mediaType: (message as Record<string, unknown>).mediaType as string,
            linkedCheckInId: message.linkedCheckInId,
            createdAt: message.createdAt,
        };

        webSocketService.broadcast('NEW_MESSAGE', messageDto);
        return messageDto;
    }

    /**
     * Normalize phone number (remove + and spaces, handle 8/7 prefixes)
     * Target format: 77713877225 (No plus, 11 digits for KZ)
     */
    private normalizePhone(phone: string): string {
        // 1. Remove all non-digits
        let clean = phone.replace(/\D/g, '');

        // 2. Handle '8' prefix replacement for KZ/RU numbers (11 digits starting with 8)
        // e.g., 87713877225 -> 77713877225
        if (clean.length === 11 && clean.startsWith('8')) {
            clean = '7' + clean.slice(1);
        }

        // 3. (Optional) If it starts with 7 and is 11 digits, it's correct.
        // If it sends without country code (local 10 digits), we might need to prepend 7, 
        // but WhatsApp/GreenAPI usually sends full international format.

        return clean;
    }
}

// Singleton instance
export const messageService = new MessageService();
