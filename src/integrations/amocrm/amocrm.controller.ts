import type { FastifyRequest, FastifyReply } from 'fastify';
import { connectAmoCRMSchema } from './amocrm.schema.js';
import { amoCRMService } from './amocrm.service.js';
import { successResponse } from '@/common/utils/response.js';

export class AmoCRMController {
    /**
     * POST /integrations/amocrm/connect
     */
    async connect(request: FastifyRequest, reply: FastifyReply) {
        const body = connectAmoCRMSchema.parse(request.body);

        await amoCRMService.saveConfig({
            baseDomain: body.baseDomain,
            accessToken: body.accessToken,
            pipelineId: body.pipelineId,
            statusId: body.statusId,
            mappings: body.mappings as any, // Cast to any or verify type matches config
        });

        return reply.send(successResponse({ message: 'amoCRM configured successfully' }));
    }

    /**
     * GET /integrations/amocrm/status
     */
    async getStatus(_request: FastifyRequest, reply: FastifyReply) {
        const config = await amoCRMService.getConfig();
        return reply.send(successResponse({
            isConnected: !!config,
            baseDomain: config?.baseDomain,
            pipelineId: config?.pipelineId,
            statusId: config?.statusId,
            mappings: config?.mappings
        }));
    }
    /**
     * POST /integrations/amocrm/test
     */
    async test(_request: FastifyRequest, reply: FastifyReply) {
        const success = await amoCRMService.testConnection();
        return reply.send(successResponse({ success }));
    }

    /**
     * POST /integrations/amocrm/disconnect
     */
    async disconnect(_request: FastifyRequest, reply: FastifyReply) {
        await amoCRMService.disconnect();
        return reply.send(successResponse({ message: 'amoCRM disconnected' }));
    }

    /**
     * GET /integrations/amocrm/pipelines
     */
    async getPipelines(_request: FastifyRequest, reply: FastifyReply) {
        const pipelines = await amoCRMService.getPipelines();
        return reply.send(successResponse(pipelines));
    }

    /**
     * POST /integrations/amocrm/webhook
     */
    async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
        await amoCRMService.handleWebhook(request.body);
        return reply.send(successResponse({ received: true }));
    }
}

export const amoCRMController = new AmoCRMController();
