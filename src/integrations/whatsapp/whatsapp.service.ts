import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import { AppError } from '@/common/errors/AppError.js';
import type {
    WhatsAppConfig,
    WhatsAppConnectionStatus,
    ParsedInboundMessage,
    SendMessageResult,
    GreenApiWebhookBody,
} from './whatsapp.types.js';
import { messageService } from '@/modules/messages/message.service.js';
import { webSocketService } from '@/common/services/websocket.service.js';

export class WhatsAppService {


    /**
     * Get WhatsApp config from IntegrationSettings
     */
    async getConfig(): Promise<WhatsAppConfig | null> {
        const settings = await prisma.integrationSettings.findUnique({
            where: { type: 'whatsapp' },
        });

        if (!settings || !settings.isEnabled) {
            return null;
        }

        const config = settings.config as unknown as WhatsAppConfig;
        return config;
    }

    /**
     * Save WhatsApp config to IntegrationSettings and update Green API settings
     */
    async saveConfig(config: WhatsAppConfig): Promise<void> {
        // 1. Save to DB
        await prisma.integrationSettings.upsert({
            where: { type: 'whatsapp' },
            update: {
                config: config as object,
                isEnabled: true,
            },
            create: {
                type: 'whatsapp',
                config: config as object,
                isEnabled: true,
            },
        });


        // 2. Try to update settings in Green API (SetSettings)
        try {
            if (config.apiUrl && config.idInstance && config.apiTokenInstance) {
                // Use app.link-it.tech because it has a valid SSL certificate
                // api.link-it.tech has a cert mismatch (CN=app.link-it.tech)
                const webhookUrl = 'https://app.link-it.tech/api/v1/integrations/whatsapp/webhook';
                const url = `${config.apiUrl}/waInstance${config.idInstance}/SetSettings/${config.apiTokenInstance}`;

                const payload = {
                    webhookUrl,
                    incomingWebhook: 'yes',
                    outgoingWebhook: 'yes',
                    deviceWebhook: 'no',
                    statusInstanceWebhook: 'yes',
                    stateWebhook: 'yes',
                    enableMessagesHistory: 'yes',
                    keepOnlineStatus: 'yes',
                };

                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                logger.info({ webhookUrl }, 'Green API settings updated (webhooks enabled)');
            }
        } catch (error) {
            logger.error({ error }, 'Failed to set Green API settings');
            // Don't block saving config
        }
    }

    /**
     * Send message via Green API with retry logic
     */
    async sendMessage(phone: string, text: string, maxRetries = 3): Promise<SendMessageResult> {
        const config = await this.getConfig();

        if (!config) {
            logger.warn('WhatsApp not configured, message not sent');
            return { whatsappMessageId: '', success: false };
        }

        const chatId = this.formatChatId(phone);
        const url = `${config.apiUrl}/waInstance${config.idInstance}/sendMessage/${config.apiTokenInstance}`;

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId,
                        message: text,
                    }),
                });

                if (response.ok) {
                    const data = (await response.json()) as { idMessage?: string };
                    logger.info({ phone, attempt, messageId: data.idMessage }, 'Message sent successfully');
                    return {
                        whatsappMessageId: data.idMessage || '',
                        success: true,
                    };
                }

                const errorText = await response.text();
                lastError = new Error(`HTTP ${response.status}: ${errorText}`);
                logger.warn({ status: response.status, error: errorText, phone, attempt }, 'Green API sendMessage failed, will retry');

            } catch (error) {
                lastError = error as Error;
                logger.warn({ error, phone, attempt }, 'Green API sendMessage error, will retry');
            }

            // Exponential backoff: 1s, 3s, 9s
            if (attempt < maxRetries) {
                const delay = Math.pow(3, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        logger.error({ error: lastError, phone, attempts: maxRetries }, 'Green API sendMessage failed after all retries');
        return { whatsappMessageId: '', success: false };
    }

    /**
     * Update message delivery status in database
     */
    async updateDeliveryStatus(whatsappMessageId: string, status: 'sent' | 'delivered' | 'read'): Promise<void> {
        const statusMap: Record<string, string> = {
            'sent': 'SENT',
            'delivered': 'DELIVERED',
            'read': 'READ',
        };

        const prismaStatus = statusMap[status];
        if (!prismaStatus) return;

        try {
            // Find message first to get ID and PatientID for broadcast
            const messages = await prisma.message.findMany({
                where: { whatsappMessageId },
                select: { id: true, patientId: true }
            });

            if (messages.length === 0) return;

            // Update status
            await prisma.message.updateMany({
                where: { whatsappMessageId },
                data: { deliveryStatus: prismaStatus as any },
            });

            // Broadcast updates
            for (const msg of messages) {
                webSocketService.broadcast('MESSAGE_UPDATED', {
                    id: msg.id,
                    patientId: msg.patientId,
                    deliveryStatus: prismaStatus,
                });
            }

            logger.debug({ whatsappMessageId, status: prismaStatus, count: messages.length }, 'Message delivery status updated');
        } catch (error) {
            logger.warn({ error, whatsappMessageId, status }, 'Failed to update delivery status');
        }
    }

    /**
     * Handle incoming webhook
     */
    async handleWebhook(body: GreenApiWebhookBody): Promise<void> {
        // Log raw body immediately
        logger.info({
            type: body?.typeWebhook,
            hasSender: !!body?.senderData,
            hasMessage: !!body?.messageData,
            raw: JSON.stringify(body).slice(0, 500) // Log first 500 chars to avoid huge logs
        }, 'Processing WhatsApp webhook - RAW DEBUG');

        // Handle delivery status updates for outgoing messages
        if (body.typeWebhook === 'outgoingMessageStatus') {
            const status = (body as any).status as string;
            const messageId = body.idMessage;
            if (messageId && ['sent', 'delivered', 'read'].includes(status)) {
                await this.updateDeliveryStatus(messageId, status as 'sent' | 'delivered' | 'read');
            }
            return;
        }

        // Handle outgoing messages (sent from phone)
        if (body.typeWebhook === 'outgoingMessageReceived' || body.typeWebhook === 'outgoingAPIMessageReceived') {
            const parsed = this.parseWebhook(body);
            if (parsed) {
                await messageService.saveSyncedMessage({
                    phone: parsed.phone,
                    text: parsed.text,
                    mediaUrl: parsed.mediaUrl,
                    mediaType: parsed.mediaType,
                    whatsappMessageId: parsed.whatsappMessageId,
                    timestamp: parsed.timestamp,
                });
                logger.info({ messageId: parsed.whatsappMessageId }, 'Synced outgoing message from phone');
            }
            return;
        }

        const parsed = this.parseWebhook(body);
        if (!parsed) {
            logger.info({ type: body?.typeWebhook }, 'Webhook ignored (not incoming message or invalid)');
            return;
        }

        try {
            await messageService.saveInboundMessage({
                phone: parsed.phone,
                text: parsed.text,
                mediaUrl: parsed.mediaUrl,
                mediaType: parsed.mediaType,
                whatsappMessageId: parsed.whatsappMessageId,
                timestamp: parsed.timestamp,
            });
        } catch (error) {
            logger.error({ error, parsed }, 'Failed to process WhatsApp webhook');
            // Don't throw to avoid 500 to Green API, they might retry aggressively
        }
    }

    /**
     * Parse webhook from Green API (Incoming or Outgoing)
     */
    parseWebhook(body: GreenApiWebhookBody): ParsedInboundMessage | null {
        // Accept both incoming and outgoing messages
        if (!['incomingMessageReceived', 'outgoingMessageReceived', 'outgoingAPIMessageReceived'].includes(body.typeWebhook)) {
            return null;
        }

        if (!body.senderData || !body.messageData) {
            return null;
        }

        const { senderData, messageData, idMessage, timestamp } = body;

        // Extract phone number
        // For INCOMING: senderData.sender is the patient
        // For OUTGOING: senderData.chatId is the patient
        let rawPhone = senderData.sender;
        if (body.typeWebhook === 'outgoingMessageReceived' || body.typeWebhook === 'outgoingAPIMessageReceived') {
            rawPhone = senderData.chatId;
        }

        const phone = this.extractPhone(rawPhone);

        let text: string | undefined;
        let mediaUrl: string | undefined;
        let mediaType: string | undefined;

        switch (messageData.typeMessage) {
            case 'textMessage':
                text = messageData.textMessageData?.textMessage;
                break;

            case 'extendedTextMessage':
                text = messageData.extendedTextMessageData?.text;
                break;

            case 'quotedMessage':
                // Reply with quote - text is in extendedTextMessageData
                text = messageData.extendedTextMessageData?.text;
                break;

            case 'imageMessage':
                // GreenAPI sometimes puts image data in fileMessageData
                mediaUrl = messageData.imageMessageData?.downloadUrl || messageData.fileMessageData?.downloadUrl;
                mediaType = 'image';
                text = messageData.imageMessageData?.caption || messageData.fileMessageData?.caption;
                break;

            case 'audioMessage':
                // Audio is also often in fileMessageData or audioMessageData (not typed in SDK sometimes)
                mediaUrl = (messageData as any).audioMessageData?.downloadUrl || messageData.fileMessageData?.downloadUrl;
                mediaType = 'audio';
                break;

            case 'videoMessage':
                mediaUrl = (messageData as any).videoMessageData?.downloadUrl || messageData.fileMessageData?.downloadUrl;
                mediaType = 'video';
                text = (messageData as any).videoMessageData?.caption;
                break;

            case 'documentMessage':
            case 'fileMessage':
                mediaUrl = messageData.fileMessageData?.downloadUrl;
                mediaType = 'file';
                text = messageData.fileMessageData?.caption;
                break;

            case 'stickerMessage':
                // Stickers - log as placeholder text
                text = '[стикер]';
                break;

            case 'reactionMessage':
                // Reactions to messages
                const reaction = (messageData as any).reactionMessageData?.reaction;
                text = reaction ? `[реакция: ${reaction}]` : '[реакция]';
                break;

            case 'locationMessage':
                // Location sharing
                const loc = (messageData as any).locationMessageData;
                if (loc) {
                    text = `[локация: ${loc.latitude}, ${loc.longitude}]`;
                    if (loc.nameLocation) text = `[локация: ${loc.nameLocation}]`;
                } else {
                    text = '[локация]';
                }
                break;

            case 'contactMessage':
                // Contact sharing
                const contact = (messageData as any).contactMessageData;
                if (contact?.displayName) {
                    text = `[контакт: ${contact.displayName}]`;
                } else {
                    text = '[контакт]';
                }
                break;

            case 'pollMessage':
                // Poll messages
                const poll = (messageData as any).pollMessageData;
                if (poll?.name) {
                    text = `[опрос: ${poll.name}]`;
                } else {
                    text = '[опрос]';
                }
                break;

            default:
                // Fallback: If it has fileMessageData with downloadUrl, treat as file/media
                if (messageData.fileMessageData?.downloadUrl) {
                    mediaUrl = messageData.fileMessageData.downloadUrl;
                    mediaType = 'file';
                    text = messageData.fileMessageData.caption;
                } else {
                    // Log unknown type for debugging but still process it
                    logger.warn({ type: messageData.typeMessage }, 'Unknown WhatsApp message type');
                    text = `[${messageData.typeMessage || 'неизвестное сообщение'}]`;
                }
        }

        return {
            phone,
            text,
            mediaUrl,
            mediaType,
            whatsappMessageId: idMessage,
            timestamp,
        };
    }

    /**
     * Check connection status with detailed diagnostics
     */
    async getDetailedStatus(): Promise<WhatsAppConnectionStatus> {
        const config = await this.getConfig();

        if (!config) {
            return { status: 'NOT_CONFIGURED', details: 'Settings missing in database' };
        }

        try {
            // 1. Check Instance State
            const stateUrl = `${config.apiUrl}/waInstance${config.idInstance}/getStateInstance/${config.apiTokenInstance}`;
            const stateRes = await fetch(stateUrl);

            if (!stateRes.ok) {
                return { status: 'DISCONNECTED', details: 'Integration API unreachable' };
            }

            const stateData = (await stateRes.json()) as { stateInstance?: string };
            const state = stateData.stateInstance?.toLowerCase();

            if (state === 'notauthorized') {
                const qrCode = await this.getQrCode();
                return { status: 'AUTH_FAILED', qrCode, details: 'Scan QR code to connect' };
            }

            if (state !== 'authorized') {
                return { status: 'DISCONNECTED', details: `Instance state: ${state}` };
            }

            // 2. Check Webhook Settings (only if authorized)
            const settingsUrl = `${config.apiUrl}/waInstance${config.idInstance}/getSettings/${config.apiTokenInstance}`;
            const settingsRes = await fetch(settingsUrl);

            if (settingsRes.ok) {
                const settingsData = (await settingsRes.json()) as { webhookUrl?: string; incomingWebhook?: string };
                // Use the configured mediaUrl as base for comparison
                // If mediaUrl is just a domain, ensure protocol
                let baseUrl = config.mediaUrl;
                if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

                const expectedPath = '/api/v1/integrations/whatsapp/webhook';
                const currentWebhook = settingsData.webhookUrl || '';

                const isIncomingEnabled = settingsData.incomingWebhook === 'yes';

                // Allow fuzzy match for ngrok or local tunnels
                const isWebhookCorrect = currentWebhook.includes(expectedPath);

                if (!isIncomingEnabled || !isWebhookCorrect) {
                    // Try to auto-fix if configured
                    await this.saveConfig(config);

                    return {
                        status: 'WEBHOOK_MISSING',
                        details: `Webhook mismatched. Got: ${currentWebhook}`
                    };
                }
            }

            return { status: 'CONNECTED', details: 'Ready to send and receive' };

        } catch (error) {
            logger.error({ error }, 'Green API checkStatus error');
            return { status: 'DISCONNECTED', details: 'Internal check failed' };
        }
    }

    /**
     * Get QR code for authorization
     */
    async getQrCode(): Promise<string | undefined> {
        const config = await this.getConfig();

        if (!config) {
            throw AppError.badRequest('WhatsApp not configured');
        }

        try {
            const url = `${config.apiUrl}/waInstance${config.idInstance}/qr/${config.apiTokenInstance}`;

            const response = await fetch(url);

            if (!response.ok) {
                return undefined;
            }

            const data = (await response.json()) as { message?: string; type?: string };

            // If already authorized, no QR available
            if (data.type === 'alreadyLogged') {
                return undefined;
            }

            // Return base64 QR code
            return data.message;
        } catch (error) {
            logger.error({ error }, 'Green API getQrCode error');
            return undefined;
        }
    }

    /**
     * Format phone number to Green API chatId format
     */
    private formatChatId(phone: string): string {
        // Remove all non-digits
        const digits = phone.replace(/\D/g, '');
        // Add @c.us suffix
        return `${digits}@c.us`;
    }

    /**
     * Extract phone number from chatId
     */
    private extractPhone(chatId: string): string {
        // Remove @c.us suffix and format
        return chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
    }
}

// Singleton instance
export const whatsAppService = new WhatsAppService();
