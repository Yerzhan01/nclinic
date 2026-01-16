import { Worker, Job } from 'bullmq';
import { env } from '@/config/env.js';
import { logger } from '@/common/utils/logger.js';
import { aiService } from './ai.service.js';
import { AI_QUEUE_NAME } from './ai.queue.js';
import { redis } from '@/config/redis.js';
import { Redis } from 'ioredis';
import { messageService } from '@/modules/messages/message.service.js';

interface AIJobData {
    patientId: string;
}

const worker = new Worker<AIJobData>(
    AI_QUEUE_NAME,
    async (job: Job<AIJobData>) => {
        const { patientId } = job.data;
        logger.info({ jobId: job.id, patientId }, 'Processing buffered AI job');

        try {
            // Fetch all buffered messages from Redis List
            // Using LRANGE to get all items
            const redisKey = `patient:${patientId}:buffer`;
            const messages = await redis.lrange(redisKey, 0, -1);

            if (!messages || messages.length === 0) {
                logger.warn({ patientId }, 'No messages in buffer for job');
                return;
            }

            // Combine messages (oldest first, because we RPUSHed)
            const combinedText = messages.join('\n');
            logger.info({ patientId, msgCount: messages.length, combinedText }, 'Combined patient messages');

            // Clear buffer immediately
            await redis.del(redisKey);

            // Analyze combined text
            const analysis = await aiService.analyzeMessage(combinedText, patientId);

            if (analysis) {
                await messageService.processAnalysisResult(patientId, analysis);
            } else {
                logger.warn({ patientId }, 'AI analysis returned null');
            }

        } catch (error) {
            logger.error({ error, patientId }, 'AI Worker failed');
            throw error;
        }
    },
    {
        connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) as any,
        concurrency: 5, // Process up to 5 chats in parallel
    }
);

worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'AI Job completed');
});

worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'AI Job failed');
});

export function startAIWorker() {
    logger.info('AI Worker started');
}
