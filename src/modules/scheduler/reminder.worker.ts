
import { systemLogService } from '@/modules/system/system-log.service.js';
import { createWorker } from '@/config/queue.js';

// ... (existing imports)


import { logger } from '@/common/utils/logger.js';
import { programService } from '@/modules/programs/program.service.js';
import { prisma } from '@/config/prisma.js';
import { TaskStatus, TaskPriority, TaskType, TaskSource } from '@prisma/client';
import { engagementService } from '@/modules/engagement/engagement.service.js';
import { amoCRMService } from '@/integrations/amocrm/amocrm.service.js';

const QUEUE_NAME = 'reminders';

export const reminderWorker = createWorker(
    QUEUE_NAME,
    async (job) => {
        const jobName = job.name;
        logger.info({ job: jobName }, 'Processing reminder/scheduler job');

        try {
            if (jobName === 'daily-program-update') {
                await processDailyUpdates();
                await systemLogService.create('INFO', 'SCHEDULER', 'Daily program update completed');
            } else if (jobName === 'process-re-engagement') {
                const asked = await engagementService.processReEngagement();
                if (asked > 0) {
                    await systemLogService.create('INFO', 'SCHEDULER', `Sent ${asked} re-engagement nudges`);
                    logger.info(`Re-engagement job: Sent ${asked} messages.`);
                }
            } else {
                // Default behavior (check-missed-checkins or generic)
                const count = await programService.processReminders();
                if (count > 0) {
                    logger.info(`Reminder job complete. Sent ${count} reminders.`);
                    await systemLogService.create('INFO', 'SCHEDULER', `Sent ${count} reminders/check-ins`);
                }

                // 2. Escalation Logic
                await checkAndEscalateTasks();

                // 3. Retention Logic
                await checkRetentionRisks();
            }

            return { success: true };
        } catch (error) {
            logger.error({ error, job: jobName }, 'Job failed');
            await systemLogService.create('ERROR', 'SCHEDULER', `Job ${jobName} failed`, { error: (error as Error).message });
            throw error;
        }
    }
);

logger.info(`Worker for queue '${QUEUE_NAME}' started`);

// Daily Program Update Logic
async function processDailyUpdates() {
    try {
        const programs = await prisma.programInstance.findMany({
            where: { status: 'ACTIVE' },
            include: { template: true }
        });

        logger.info({ count: programs.length }, 'Running daily program updates');

        for (const p of programs) {
            const newDay = p.currentDay + 1;

            await prisma.programInstance.update({
                where: { id: p.id },
                data: { currentDay: newDay }
            });

            // Trigger AmoCRM Sync based on Week
            let trigger: import('@/integrations/amocrm/amocrm.types.js').AmoMappingTrigger | null = null;

            if (newDay === 8) trigger = 'WEEK_2';
            else if (newDay === 15) trigger = 'WEEK_3';
            else if (newDay === 22) trigger = 'WEEK_4';
            else if (newDay === 29) trigger = 'WEEK_5';
            else if (newDay === 36) trigger = 'WEEK_6';

            if (trigger) {
                await amoCRMService.syncPatientState(p.patientId, trigger);
            }

            // Completion Check
            if (p.template && newDay > p.template.durationDays) {
                await prisma.programInstance.update({
                    where: { id: p.id },
                    data: { status: 'COMPLETED', endDate: new Date() }
                });
                await amoCRMService.syncPatientState(p.patientId, 'PROGRAM_COMPLETED');
                logger.info({ programId: p.id, patientId: p.patientId }, 'Program completed');
            }
        }
    } catch (error) {
        logger.error({ error }, 'Error in processDailyUpdates');
    }
}

// Escalation Rule: HIGH priority overdue > 2h -> Create FOLLOW_UP
async function checkAndEscalateTasks() {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        const candidates = await prisma.task.findMany({
            where: {
                status: TaskStatus.OPEN,
                priority: TaskPriority.HIGH,
                createdAt: { lt: twoHoursAgo },
            }
        });

        for (const task of candidates) {
            const existingEscalation = await prisma.task.findFirst({
                where: {
                    patientId: task.patientId,
                    type: TaskType.FOLLOW_UP,
                    status: TaskStatus.OPEN,
                    source: TaskSource.SYSTEM,
                }
            });

            if (!existingEscalation) {
                await prisma.task.create({
                    data: {
                        patientId: task.patientId,
                        type: TaskType.FOLLOW_UP,
                        priority: TaskPriority.HIGH,
                        title: '⚠️ CRITICAL: Просроченная задача',
                        description: `Задача "${task.title}" (HIGH) просрочена более чем на 2 часа. Требуется немедленная реакция.`,
                        source: TaskSource.SYSTEM,
                        status: TaskStatus.OPEN,
                        meta: {
                            escalatedFromTaskId: task.id
                        }
                    }
                });
                logger.warn({ originalTaskId: task.id, patientId: task.patientId }, 'Escalated overdue HIGH task');
            }
        }
    } catch (error) {
        logger.error({ error }, 'Error in checkAndEscalateTasks');
    }
}

// Retention Rule: Engagement < 40 -> Create FOLLOW_UP
async function checkRetentionRisks() {
    try {
        // Find recent active patients (optimization: those with messages/checkins in last 3 days?)
        // For MVP, just scan all Active patients in programs.
        const activePrograms = await prisma.programInstance.findMany({
            where: { status: 'ACTIVE' },
            select: { patientId: true }
        });

        const patientIds = [...new Set(activePrograms.map(p => p.patientId))];

        for (const pid of patientIds) {
            const result = await engagementService.calculateEngagement(pid);

            if (result.status === 'HIGH_RISK') {
                const existingRetentionTask = await prisma.task.findFirst({
                    where: {
                        patientId: pid,
                        type: TaskType.FOLLOW_UP,
                        status: TaskStatus.OPEN,
                        source: TaskSource.SYSTEM,
                        title: 'Риск оттока пациента'
                    }
                });

                if (!existingRetentionTask) {
                    await prisma.task.create({
                        data: {
                            patientId: pid,
                            type: TaskType.FOLLOW_UP,
                            priority: TaskPriority.HIGH,
                            title: 'Риск оттока пациента',
                            description: `Пациент потерял вовлечённость. Факторы: ${result.factors.join(', ')}`,
                            source: TaskSource.SYSTEM,
                            status: TaskStatus.OPEN,
                            meta: {
                                engagementScore: result.score,
                                engagementFactors: result.factors
                            }
                        }
                    });
                    logger.warn({ patientId: pid, score: result.score }, 'Created Retention Task');
                }
            }
        }
    } catch (error) {
        logger.error({ error }, 'Error in checkRetentionRisks');
    }
}
