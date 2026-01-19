import type { FastifyRequest, FastifyReply } from 'fastify';
import { patientIdParamSchema, sendMessageSchema } from './message.schema.js';
import { messageService } from './message.service.js';
import { whatsAppService } from '@/integrations/whatsapp/whatsapp.service.js';
import { aiService } from '@/integrations/ai/ai.service.js';
import { parseAiCommand, isAiCommand } from '@/common/utils/aiCommand.utils.js';
import { successResponse } from '@/common/utils/response.js';
import { logger } from '@/common/utils/logger.js';
import type { GreenApiWebhookBody } from '@/integrations/whatsapp/whatsapp.types.js';

export class MessageController {
    /**
     * GET /messages/:patientId - Get messages for a patient
     */
    async getMessages(request: FastifyRequest, reply: FastifyReply) {
        const { patientId } = patientIdParamSchema.parse(request.params);
        const messages = await messageService.getMessages(patientId);
        return reply.send(successResponse(messages));
    }

    /**
     * POST /messages/:patientId/send - Send staff message to patient
     * Also handles #ai off/on/status commands
     */
    async sendMessage(request: FastifyRequest, reply: FastifyReply) {
        const { patientId } = patientIdParamSchema.parse(request.params);
        const { text } = sendMessageSchema.parse(request.body);

        const config = await aiService.getConfig();
        const commandSettings = config?.agent?.commands;

        // Check for AI commands (#ai off, #ai on, #ai status)
        if (isAiCommand(text, commandSettings?.prefix)) {
            const { action } = parseAiCommand(text, commandSettings);

            if (action === 'pause') {
                await aiService.togglePatientAI(patientId, true, undefined, text);
                logger.info({ patientId }, 'AI paused via chat command');
                return reply.send(successResponse({
                    command: true,
                    action: 'pause',
                    message: 'AI выключен для этого пациента. Все сообщения теперь обрабатывает менеджер.'
                }));
            }

            if (action === 'resume') {
                await aiService.togglePatientAI(patientId, false);
                logger.info({ patientId }, 'AI resumed via chat command');
                return reply.send(successResponse({
                    command: true,
                    action: 'resume',
                    message: 'AI включен. Теперь AI будет анализировать сообщения пациента.'
                }));
            }

            if (action === 'status') {
                const status = await aiService.getPatientAIStatus(patientId);
                return reply.send(successResponse({
                    command: true,
                    action: 'status',
                    aiEnabled: !status.aiPaused,
                    message: status.aiPaused
                        ? `AI выключен с ${status.aiPausedAt?.toLocaleString('ru-RU')} пользователем ${status.aiPausedBy}`
                        : 'AI включен и активен'
                }));
            }
        }

        // Regular message - send to patient
        const message = await messageService.sendStaffMessage(patientId, text);
        return reply.status(201).send(successResponse(message));
    }

    /**
     * POST /whatsapp/webhook - Receive Green API webhook
     */
    async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
        try {
            const body = request.body as GreenApiWebhookBody;

            // Parse the webhook
            const parsed = whatsAppService.parseIncomingWebhook(body);

            if (!parsed) {
                // Not an incoming message (status update, etc.) - just acknowledge
                return reply.send({ success: true });
            }

            // Save the inbound message
            await messageService.saveInboundMessage(parsed);

            // Always return 200 for Green API
            return reply.send({ success: true });
        } catch (error) {
            logger.error({ error }, 'Webhook processing error');
            // Always return 200 to prevent Green API retries
            return reply.send({ success: true });
        }
    }
}

export const messageController = new MessageController();
