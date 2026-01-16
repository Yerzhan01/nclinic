
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
    // Health check - checks both database and redis
    app.get('/health', async (_request, reply) => {
        try {
            // Check database connection
            await prisma.$queryRaw`SELECT 1`;

            // Check redis connection
            await redis.ping();

            return reply.send(
                successResponse({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: 'connected',
                        redis: 'connected',
                    },
                })
            );
        } catch (error) {
            const err = error as Error;
            return reply.status(503).send(
                successResponse({
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    error: err.message,
                })
            );
        }
    });

    // API version info
    app.get(API_PREFIX, async (_request, reply) => {
        return reply.send(
            successResponse({
                name: 'Patient Assistant System API',
                version: '1.0.0',
                prefix: API_PREFIX,
            })
        );
    });

    // Register module routers
    await app.register(authRouter, { prefix: `${API_PREFIX}/auth` });
    await app.register(usersRouter, { prefix: `${API_PREFIX}/users` });
    await app.register(patientRouter, { prefix: `${API_PREFIX}/patients` });
    await app.register(programRouter, { prefix: `${API_PREFIX}/programs` });
    await app.register(messageRouter, { prefix: `${API_PREFIX}/messages` });
    await app.register(alertRouter, { prefix: `${API_PREFIX}/alerts` });
    await app.register(taskRouter, { prefix: `${API_PREFIX}/tasks` });
    await app.register(ragRouter, { prefix: `${API_PREFIX}/rag` });
    await app.register(checkInRouter, { prefix: API_PREFIX });

    await app.register(analyticsRouter, { prefix: `${API_PREFIX}/analytics` });
    await app.register(engagementRoutes, { prefix: API_PREFIX });

    // Integration admin routes
    await app.register(whatsAppIntegrationRouter, { prefix: `${API_PREFIX}/integrations/whatsapp` });
    await app.register(aiIntegrationRouter, { prefix: `${API_PREFIX}/integrations/ai` });
    await app.register(registerAITestingRoutes, { prefix: `${API_PREFIX}/ai` });
    await app.register(amoCRMRouter, { prefix: `${API_PREFIX}/integrations/amocrm` });

    // System (OLD + NEW)
    await app.register(systemRouter, { prefix: `${API_PREFIX}/system` });
    await app.register(systemApi, { prefix: `${API_PREFIX}/system` });

    // WebSocket
    await app.register(websocketRouter, { prefix: `${API_PREFIX}` });

}
