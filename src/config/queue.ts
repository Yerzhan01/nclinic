import { Queue, Worker, type Job, type Processor } from 'bullmq';
import { env } from './env.js';

// Parse Redis URL for BullMQ connection (needs separate connection, not shared client)
const redisUrl = new URL(env.REDIS_URL);
const redisConnection = {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
};

// Default queue options
export const defaultQueueOptions = {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential' as const,
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
};

// Queue factory
export function createQueue(name: string): Queue {
    return new Queue(name, defaultQueueOptions);
}

// Worker factory
export function createWorker<T = unknown>(
    queueName: string,
    processor: Processor<T>,
    concurrency = 5
): Worker<T> {
    const worker = new Worker<T>(queueName, processor, {
        connection: redisConnection,
        concurrency,
    });

    worker.on('completed', (job: Job<T>) => {
        console.log(`✅ Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on('failed', (job: Job<T> | undefined, error: Error) => {
        console.error(`❌ Job ${job?.id} failed in queue ${queueName}:`, error.message);
    });

    worker.on('error', (error: Error) => {
        console.error(`❌ Worker error in queue ${queueName}:`, error.message);
    });

    return worker;
}

// Pre-defined queues for future modules
export const queues = {
    // Example: notifications, reminders, etc.
    // These will be created when modules are implemented
} as const;
// Re-export queues and workers
// export * from '../jobs/amoSync.worker.js';
