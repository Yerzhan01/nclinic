import type { FastifyRequest, FastifyReply } from 'fastify';
import { connectWhatsAppSchema } from './whatsapp.schema.js';
import { whatsAppService } from './whatsapp.service.js';
import { successResponse } from '@/common/utils/response.js';

export class WhatsAppController {
    /**
     * POST /integrations/whatsapp/connect - Connect WhatsApp instance
     */
    async connect(request: FastifyRequest, reply: FastifyReply) {
        const body = connectWhatsAppSchema.parse(request.body);

        // Save config to database
        await whatsAppService.saveConfig({
            idInstance: body.idInstance,
            apiTokenInstance: body.apiTokenInstance,
            apiUrl: body.apiUrl,
            mediaUrl: body.mediaUrl,
        });

        // Check connection status
        const connectionStatus = await whatsAppService.getDetailedStatus();

        return reply.send(
            successResponse({
                message: 'WhatsApp configuration saved',
                ...connectionStatus,
            })
        );
    }

    /**
     * GET /integrations/whatsapp/status - Get connection status
     */
    async getStatus(_request: FastifyRequest, reply: FastifyReply) {
        const connectionStatus = await whatsAppService.getDetailedStatus();
        return reply.send(successResponse(connectionStatus));
    }

    /**
     * POST /integrations/whatsapp/webhook - Public webhook handler
     */
    async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
        const body = request.body as any; // GreenApiWebhookBody

        // Asynchronous processing - don't block Green API response
        // But for MVP we can await it to ensure at least parsing works
        // Fire and forget - don't block the HTTP response
        whatsAppService.handleWebhook(body).catch(err => {
            request.log.error({ err }, 'Background webhook processing failed');
        });

        return reply.send({ status: 'ok' });
    }

    /**
     * POST /integrations/whatsapp/reconnect - Force QR refresh
     */
    async reconnect(_request: FastifyRequest, reply: FastifyReply) {
        const qrCode = await whatsAppService.getQrCode();

        return reply.send(
            successResponse({
                status: qrCode ? 'notAuthorized' : 'connected',
                qrCode,
            })
        );
    }
}

export const whatsAppController = new WhatsAppController();
