import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { connectAISchema, testAISchema } from './ai.schema.js';
import { aiService } from './ai.service.js';
import { successResponse } from '@/common/utils/response.js';

// Schema for AI settings update
const updateSettingsSchema = z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    messageBufferSeconds: z.number().min(0).max(300).optional(),
    agent: z.object({
        systemPromptBase: z.string().optional(),
        styleGuide: z.string().optional(),
        replyStyle: z.enum(['concise', 'structured', 'detailed']).optional(),
        format: z.enum(['bullets', 'paragraphs']).optional(),
        maxSentences: z.number().min(1).max(12).optional(),
        maxOutputTokens: z.number().min(50).max(4096).optional(),
        handoffTriggers: z.array(z.string()).optional(),
        forbiddenPhrases: z.array(z.string()).optional(),
        commands: z.object({
            prefix: z.string().optional(),
            pauseKeywords: z.array(z.string()).optional(),
            resumeKeywords: z.array(z.string()).optional(),
            statusKeywords: z.array(z.string()).optional(),
        }).optional(),
    }).optional(),
    rag: z.object({
        enabled: z.boolean().optional(),
        topK: z.number().min(1).max(20).optional(),
        maxChars: z.number().min(100).max(4000).optional(),
    }).optional(),
});

// Schema for AI toggle
const toggleAISchema = z.object({
    enabled: z.boolean(),
    reason: z.string().optional(),
});

const patientIdParamSchema = z.object({
    patientId: z.string(),
});

export class AIController {
    /**
     * POST /integrations/ai/connect - Connect AI (save API key)
     */
    async connect(request: FastifyRequest, reply: FastifyReply) {
        const body = connectAISchema.parse(request.body);

        await aiService.saveConfig({
            provider: 'openai',
            apiKey: body.apiKey,
            model: body.model,
            temperature: body.temperature,
        });

        const status = await aiService.getStatus();

        return reply.send(
            successResponse({
                message: 'AI configuration saved',
                ...status,
            })
        );
    }

    /**
     * GET /integrations/ai/status - Get AI connection status
     */
    async getStatus(_request: FastifyRequest, reply: FastifyReply) {
        const status = await aiService.getStatus();
        return reply.send(successResponse(status));
    }

    /**
     * GET /integrations/ai/settings - Get full AI settings
     */
    async getSettings(_request: FastifyRequest, reply: FastifyReply) {
        const settings = await aiService.getSettings();
        return reply.send(successResponse(settings ?? {}));
    }

    /**
     * PUT /integrations/ai/settings - Update AI settings
     */
    async updateSettings(request: FastifyRequest, reply: FastifyReply) {
        const body = updateSettingsSchema.parse(request.body);
        const updated = await aiService.updateSettings(body);
        return reply.send(successResponse(updated));
    }

    /**
     * POST /integrations/ai/test - Test AI analysis
     */
    async test(request: FastifyRequest, reply: FastifyReply) {
        const body = testAISchema.parse(request.body);

        const analysis = await aiService.analyzeMessage(body.text, 'test');

        if (!analysis) {
            return reply.status(500).send(
                successResponse({
                    error: 'AI analysis failed. Check configuration.',
                })
            );
        }

        return reply.send(successResponse({ analysis }));
    }

    /**
     * POST /patients/:patientId/ai-toggle - Toggle AI for specific patient
     */
    async togglePatientAI(request: FastifyRequest, reply: FastifyReply) {
        const { patientId } = patientIdParamSchema.parse(request.params);
        const { enabled, reason } = toggleAISchema.parse(request.body);

        // enabled=true means AI is ON, so aiPaused=false
        await aiService.togglePatientAI(patientId, !enabled, undefined, reason);

        const status = await aiService.getPatientAIStatus(patientId);

        return reply.send(successResponse({
            message: enabled ? 'AI включен для пациента' : 'AI выключен для пациента',
            aiEnabled: !status.aiPaused,
            ...status,
        }));
    }

    /**
     * GET /patients/:patientId/ai-status - Get AI status for patient
     */
    async getPatientAIStatus(request: FastifyRequest, reply: FastifyReply) {
        const { patientId } = patientIdParamSchema.parse(request.params);
        const status = await aiService.getPatientAIStatus(patientId);

        return reply.send(successResponse({
            aiEnabled: !status.aiPaused,
            ...status,
        }));
    }
}

export const aiController = new AIController();
