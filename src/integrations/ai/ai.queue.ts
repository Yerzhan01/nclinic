import { Queue } from 'bullmq';
import { env } from '@/config/env.js';
import { logger } from '@/common/utils/logger.js';
import { Redis } from 'ioredis';

export const AI_QUEUE_NAME = 'ai-message-processing';

const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

export const aiQueue = new Queue(AI_QUEUE_NAME, {
    connection: connection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

export const scheduleAIAnalysis = async (patientId: string, delaySeconds: number = 10) => {
    const jobId = `analyze-${patientId}`;
    logger.debug({ patientId, jobId, delaySeconds }, 'Attempting to schedule AI analysis');

    try {
        // Remove existing job to "reset" the timer (debounce)
        const job = await aiQueue.getJob(jobId);
        if (job) {
            await job.remove();
            logger.debug({ patientId, jobId }, 'Debounced AI job: removed previous job');
        }

        // Add new job with delay
        await aiQueue.add(
            'analyze-patient-messages',
            { patientId },
            {
                jobId, // Enforce uniqueness
                delay: delaySeconds * 1000,
            }
        );
        logger.debug({ patientId, delaySeconds }, 'Scheduled AI analysis job successfully');
    } catch (error: any) {
        logger.error({
            err: error,
            message: error.message,
            stack: error.stack,
            patientId
        }, 'Failed to schedule AI job');
    }
};
