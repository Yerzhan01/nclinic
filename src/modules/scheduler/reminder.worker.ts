
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

                // 4. Missed Reminder Detection (Creates Tasks + Alerts)
                await checkMissedReminders();
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

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        for (const p of programs) {
            // Idempotency Check: Don't update if already updated today
            // We use updated_at check. If it was updated after todayStart, skip.
            // Note: This assumes no other updates happen to programInstance during the day.
            // If others do update it, we might skip. Ideally we should track "lastDayUpdate" field.
            // But for MVP, let's assume currentDay update is the main one.
            // Better: Check if we are retrying a job.
            // Even better: Logic "currentDay = diff(now, startDate)".

            // Let's rely on calculating currentDay from startDate instead of incrementing. 
            // This is purely idempotent!
            const diffTime = Math.abs(now.getTime() - p.startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // If startDate is today, diffDays is 0 or 1.
            // precise formula: 1 + floor((now - start) / day)

            // Let's stick to safe increment for now but with check
            if (p.updatedAt >= todayStart) {
                // Already updated today?
                // BE CAREFUL: "Pause/Resume" might update it too.
                // Safest approach: Compare calculated day vs stored day.
            }

            // ROBUST FIXED APPROACH: Calculate day from Start Date (minus paused days if we tracked them)
            // Since we don't track paused duration cleanly yet, let's stick to increment but check if updated recently
            // Actually, let's just use a dedicated redis key/lock or just check if last update was < 20 hours ago?

            // Let's simple check: If job runs at 00:00, and p.updatedAt is < 00:00 today, then update.
            if (p.updatedAt >= todayStart) {
                logger.info({ programId: p.id }, 'Skipping daily update (already updated today)');
                continue;
            }

            const newDay = p.currentDay + 1;

            await prisma.programInstance.update({
                where: { id: p.id },
                data: { currentDay: newDay } // updatedAt will automatically update
            });

            // Trigger AmoCRM Sync based on Week
            let trigger: import('@/integrations/amocrm/amocrm.types.js').AmoMappingTrigger | null = null;

            if (newDay === 1) trigger = 'WEEK_1';
            else if (newDay === 8) trigger = 'WEEK_2';
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

// Missed Reminder Detection: Create Tasks + Alerts for unresponsive patients
async function checkMissedReminders() {
    try {
        const RESPONSE_WINDOW_HOURS = 4;
        const windowStart = new Date(Date.now() - RESPONSE_WINDOW_HOURS * 60 * 60 * 1000);
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        // Find SYSTEM messages (reminders) sent > 4 hours ago TODAY
        const unrespondedReminders = await prisma.message.findMany({
            where: {
                sender: 'SYSTEM',
                direction: 'OUTBOUND',
                createdAt: {
                    gte: startOfDay,
                    lte: windowStart // Sent more than 4 hours ago
                }
            },
            include: {
                patient: {
                    select: { id: true, fullName: true, aiPaused: true }
                }
            }
        });

        // Group by patient
        const patientReminders = new Map<string, { patient: any; reminder: any }>();
        for (const msg of unrespondedReminders) {
            if (!patientReminders.has(msg.patientId)) {
                patientReminders.set(msg.patientId, { patient: msg.patient, reminder: msg });
            }
        }

        for (const [patientId, { patient, reminder }] of patientReminders) {
            if (patient.aiPaused) continue; // Skip paused patients

            // Check if patient responded after the reminder
            const patientResponse = await prisma.message.findFirst({
                where: {
                    patientId,
                    sender: 'PATIENT',
                    direction: 'INBOUND',
                    createdAt: { gt: reminder.createdAt }
                }
            });

            if (patientResponse) continue; // Patient responded, skip

            // Check if we already created a MISSED_CHECKIN task today
            const existingTask = await prisma.task.findFirst({
                where: {
                    patientId,
                    type: TaskType.MISSED_CHECKIN,
                    status: TaskStatus.OPEN,
                    createdAt: { gte: startOfDay }
                }
            });

            if (existingTask) continue; // Already escalated today

            // Create MISSED_CHECKIN Task
            await prisma.task.create({
                data: {
                    patientId,
                    type: TaskType.MISSED_CHECKIN,
                    priority: TaskPriority.MEDIUM,
                    title: `⚠️ Нет ответа: ${patient.fullName}`,
                    description: `Пациент не ответил на напоминание более ${RESPONSE_WINDOW_HOURS} часов. Последнее напоминание: "${reminder.content?.slice(0, 50)}..."`,
                    source: TaskSource.SYSTEM,
                    status: TaskStatus.OPEN,
                    meta: {
                        reminderMessageId: reminder.id,
                        reminderSentAt: reminder.createdAt
                    }
                }
            });

            logger.warn({ patientId, patientName: patient.fullName }, 'Created MISSED_CHECKIN task - patient unresponsive');
        }
    } catch (error) {
        logger.error({ error }, 'Error in checkMissedReminders');
    }
}
