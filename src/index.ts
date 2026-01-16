import 'dotenv/config';
import { env } from '@/config/env.js';
import { connectDatabase, disconnectDatabase } from '@/config/prisma.js';
import { connectRedis, disconnectRedis } from '@/config/redis.js';
import { createServer } from '@/app/server.js';
import { registerPlugins } from '@/app/plugins.js';
import { registerRoutes } from '@/app/routes.js';
import { setupErrorHandler } from '@/common/errors/errorHandler.js';
import { logger } from '@/common/utils/logger.js';
import { initializeScheduler } from '@/modules/scheduler/scheduler.js';
import { startAIWorker } from '@/integrations/ai/ai.worker.js';
import '@/modules/scheduler/reminder.worker.js';
import '@/jobs/amoSync.worker.js';

async function bootstrap() {
    const app = createServer();

    try {

        // Connect to external services
        await connectDatabase();
        await connectRedis();

        // Initialize Scheduler
        if (env.NODE_ENV !== 'test') {
            await initializeScheduler();
        }
        // Register plugins
        await registerPlugins(app);
        // Register routes
        await registerRoutes(app);
        // Setup error handler
        setupErrorHandler(app);

        // Start server
        const address = await app.listen({
            host: '0.0.0.0',
            port: env.PORT,
        });

        logger.info(`🚀 Server listening on ${address}`);

        // Start Workers
        if (env.NODE_ENV !== 'test') {
            startAIWorker();
        }
    } catch (error) {
        logger.error(error, 'Failed to start server');
        process.exit(1);
    }

    // Graceful shutdown
    const shutdown = async (signal: string) => {
        logger.info(`${signal} received, shutting down gracefully...`);

        try {
            await app.close();
            logger.info('Server closed');

            await disconnectDatabase();
            await disconnectRedis();

            logger.info('All connections closed');
            process.exit(0);
        } catch (error) {
            logger.error(error, 'Error during shutdown');
            process.exit(1);
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
