
import { createQueue } from '@/config/queue.js';
import { logger } from '@/common/utils/logger.js';
// Worker is imported via index.ts -> import '@/modules/scheduler/reminder.worker.js'

const REMINDER_QUEUE = 'reminders';

export async function initializeScheduler() {
    const reminderQueue = createQueue(REMINDER_QUEUE);

    // Schedule 15-min job for Reminder Checks, Escalations & Check-ins
    // This triggers the 'reminder.worker.ts' logic.
    await reminderQueue.add(
        'check-missed-checkins',
        {},
        {
            repeat: {
                every: 15 * 60 * 1000,
            },
            jobId: 'check-missed-checkins-job'
        }
    );

    // Schedule Daily Updates (Cron)
    await reminderQueue.add(
        'daily-program-update',
        {},
        {
            repeat: {
                pattern: '0 0 * * *', // Daily at 00:00 UTC (05:00 Almaty)
            },
            jobId: 'daily-program-update-job'
        }
    );

    logger.info(`Scheduler initialized: ${REMINDER_QUEUE} jobs added`);
}
