import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/prisma.js';
import { redis } from '@/config/redis.js';
import { successResponse } from '@/common/utils/response.js';
import authRouter from '@/modules/auth/auth.router.js';
import usersRouter from '@/modules/users/user.router.js';
import patientRouter from '@/modules/patients/patient.router.js';
import programRouter from '@/modules/programs/program.router.js';
import messageRouter from '@/modules/messages/message.router.js';
import alertRouter from '@/modules/alerts/alert.router.js';
import { taskRouter } from '@/modules/tasks/task.router.js';
import ragRouter from '@/modules/rag/rag.router.js';
import whatsAppIntegrationRouter from '@/integrations/whatsapp/whatsapp.router.js';
import aiIntegrationRouter from '@/integrations/ai/ai.router.js';
import { registerAITestingRoutes } from '@/integrations/ai/ai.testing.router.js';
import amoCRMRouter from '@/integrations/amocrm/amocrm.router.js';
import checkInRouter from '@/modules/checkins/checkin.router.js';
import analyticsRouter from '@/modules/analytics/analytics.router.js';
import { engagementRoutes } from '@/modules/engagement/engagement.router.js';
import systemRouter from '@/modules/system/system.router.js';
import { systemApi } from '@/api/system.api.js';
import websocketRouter from '@/common/services/websocket.router.js';

const API_PREFIX = '/api/v1';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
    // ... (unchanged)

    // System
    await app.register(systemRouter, { prefix: `${API_PREFIX}/system` });
    await app.register(systemApi, { prefix: `${API_PREFIX}/system` });

    // WebSocket
    await app.register(websocketRouter, { prefix: `${API_PREFIX}` });

}
