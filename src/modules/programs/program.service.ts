import type { ProgramInstance, CheckInType } from '@prisma/client';
import { prisma } from '@/config/prisma.js';
import { AppError } from '@/common/errors/AppError.js';
import { logger } from '@/common/utils/logger.js';
import type {
    CreateProgramInstanceInput,
    CreateProgramInstanceResult,
    ActiveProgramResponse,
    ProgramTemplateRules,
    ProgramActivity,
    CheckInDto
} from './program.types.js';
import type { CreateTemplateInput, UpdateTemplateInput } from './program.schema.js';

export class ProgramService {
    /**
     * Create a program instance for a patient and generate all check-ins
     */
    async createProgramInstance(
        input: CreateProgramInstanceInput
    ): Promise<CreateProgramInstanceResult> {
        const { patientId, templateId, startDate: inputStartDate } = input;

        // Verify patient exists
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
        });

        if (!patient) {
            throw AppError.notFound('Patient not found');
        }

        // Verify template exists
        const template = await prisma.programTemplate.findUnique({
            where: { id: templateId },
        });

        if (!template) {
            throw AppError.notFound('Program template not found');
        }

        if (!template.isActive) {
            throw AppError.badRequest('Program template is not active');
        }

        // Check if patient already has an active program
        const existingActive = await prisma.programInstance.findFirst({
            where: {
                patientId,
                status: 'ACTIVE',
            },
        });

        if (existingActive) {
            throw AppError.badRequest('Patient already has an active program');
        }

        // Calculate start and end dates
        const startDate = inputStartDate ? new Date(inputStartDate) : new Date();
        startDate.setHours(0, 0, 0, 0); // Normalize to midnight

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + template.durationDays);

        const programInstance = await prisma.programInstance.create({
            data: {
                patientId,
                templateId,
                startDate,
                endDate,
                currentDay: 1,
                status: 'ACTIVE',
            },
        });

        // Dynamic AmoCRM Sync
        // We import dynamically to avoid circular dependencies if any, or just use the singleton
        const { amoCRMService } = await import('@/integrations/amocrm/amocrm.service.js');
        await amoCRMService.syncPatientState(patientId, 'PROGRAM_STARTED');

        // Initialize empty check-ins? No, we do JIT check-ins now with new engine
        // But we might want to generate "expected" check-ins for the future.
        // For Phase 21, we will stick to JIT creation by the scheduler / answers.
        const checkInsCreated = 0;

        return {
            programInstanceId: programInstance.id,
            startDate,
            endDate,
            checkInsCreated,
        };
    }

    /**
     * Generate all check-ins for a program instance
     */
    async generateCheckIns(_programInstanceId: string): Promise<number> {
        // Discontinued in favor of Dynamic Schedule
        return 0;
    }

    /**
     * Calculate the current day of a program based on start date
     */
    calculateCurrentDay(programInstance: ProgramInstance, now?: Date): number {
        const today = now ? new Date(now) : new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(programInstance.startDate);
        startDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const currentDay = diffDays + 1;

        // Clamp to valid range
        if (currentDay < 1) {
            return 1;
        }

        // Get duration roughly from instance
        // Assuming reasonably long programs, logic handles day-by-day anyway
        return currentDay;
    }

    /**
     * Get active check-ins for a patient on a specific date
     */
    async getActiveCheckIns(
        patientId: string,
        _date?: Date
    ): Promise<ActiveProgramResponse | null> {
        const date = _date || new Date();

        // 1. Get active program instance
        const programInstance = await prisma.programInstance.findFirst({
            where: {
                patientId,
                status: 'ACTIVE',
            },
            include: {
                template: true,
            },
        });

        if (!programInstance) return null;

        // 2. Calculate current day
        const currentDay = this.calculateCurrentDay(programInstance, date);
        const template = programInstance.template;

        if (!template.rules || typeof template.rules !== 'object') {
            return {
                programInstance: {
                    id: programInstance.id,
                    status: programInstance.status,
                    startDate: programInstance.startDate,
                    endDate: programInstance.endDate,
                    currentDay,
                    template: {
                        id: template.id,
                        name: template.name,
                        durationDays: template.durationDays
                    }
                },
                currentDay,
                checkIns: []
            };
        }

        // 3. Get schedule for this day from Rules
        const rules = template.rules as unknown as ProgramTemplateRules;
        const daySchedule = rules.schedule?.find(s => s.day === currentDay);

        // 4. Get existing check-ins for today (from DB)
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dbCheckIns = await prisma.checkIn.findMany({
            where: {
                patientId,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        // 5. Merge Expected vs Actual
        const checkIns: CheckInDto[] = [];

        if (daySchedule) {
            for (const activity of daySchedule.activities) {
                // Find matching DB check-in by Type (and roughly time/slot if needed, but Type is usually unique per day per slot)
                const match = dbCheckIns.find(c => c.type === activity.type && c.id); // Simple match by type for now

                checkIns.push({
                    id: match?.id || 'pending-' + activity.slot + '-' + activity.type,
                    dayNumber: currentDay,
                    slot: activity.slot,
                    expectedType: activity.type,
                    required: activity.required,
                    status: match ? match.type === 'VISIT' ? 'RECEIVED' : 'RECEIVED' : 'PENDING', // If match exists, it's done. 
                    // Note: VISIT check-ins might be created by system explicitly? Or we just show PENDING until system creates it?
                    // Ideally, if no check-in exists, it's PENDING.
                    receivedMessageId: null,
                    title: activity.question, // Use the question as the title/description
                    createdAt: match?.createdAt || new Date()
                });
            }
        }

        return {
            programInstance: {
                id: programInstance.id,
                status: programInstance.status,
                startDate: programInstance.startDate,
                endDate: programInstance.endDate,
                currentDay,
                template: {
                    id: template.id,
                    name: template.name,
                    durationDays: template.durationDays
                }
            },
            currentDay,
            checkIns
        };
    }

    /**
     * Mark overdue check-ins as MISSED
     */
    async markMissedCheckIns(_now?: Date): Promise<number> {
        return 0;
    }

    /**
     * Get program instance by ID with template
     */
    async getProgramInstanceById(id: string) {
        return prisma.programInstance.findUnique({
            where: { id },
            include: {
                template: true,
                patient: true,
            },
        });
    }

    /**
     * List all active program templates
     */
    async listTemplates() {
        return prisma.programTemplate.findMany({
            orderBy: { name: 'asc' }, // Show all, active or not? Let's show all for admin.
        });
    }

    /**
     * Create a new program template
     */
    async createTemplate(input: CreateTemplateInput) {
        return prisma.programTemplate.create({
            data: {
                name: input.name,
                durationDays: input.durationDays,
                slotsPerDay: ['MORNING', 'AFTERNOON', 'EVENING'], // Default
                isActive: input.isActive,
                rules: input.rules as any,
            },
        });
    }

    /**
     * Update an existing program template
     */
    async updateTemplate(id: string, input: UpdateTemplateInput) {
        const template = await prisma.programTemplate.findUnique({ where: { id } });
        if (!template) throw AppError.notFound('Template not found');

        return prisma.programTemplate.update({
            where: { id },
            data: {
                name: input.name,
                durationDays: input.durationDays,
                isActive: input.isActive,
                rules: input.rules ? (input.rules as any) : undefined,
            },
        });
    }

    /**
     * Delete a program template
     */
    async deleteTemplate(id: string) {
        // Option: Soft delete or check usage.
        // For now, strict check on usage.
        const usage = await prisma.programInstance.count({ where: { templateId: id } });
        if (usage > 0) {
            throw AppError.badRequest('Cannot delete template used in active/historical programs. Archive it instead.');
        }

        return prisma.programTemplate.delete({ where: { id } });
    }

    /**
     * Pause or resume a program for a patient
     */
    async pauseProgram(patientId: string, paused: boolean) {
        const activeProgram = await prisma.programInstance.findFirst({
            where: {
                patientId,
                status: 'ACTIVE',
            },
        });

        if (!activeProgram) {
            throw AppError.notFound('No active program found for this patient');
        }

        const updated = await prisma.programInstance.update({
            where: { id: activeProgram.id },
            data: {
                status: paused ? 'PAUSED' : 'ACTIVE',
            },
            include: {
                template: true,
            },
        });

        logger.info({ patientId, paused, programId: activeProgram.id }, 'Program pause status updated');

        return updated;
    }

    /**
     * Process Dynamic Schedule (Phase 21)
     * Replaces hardcoded reminders with JSON-driven logic.
     */
    async processReminders(_serverNow?: Date): Promise<number> {
        const serverNow = _serverNow || new Date();

        // Fetch active patients WITH their active program
        // We do this to avoid N+1 queries for fetching programs
        const activePatients = await prisma.patient.findMany({
            where: {
                programs: {
                    some: { status: 'ACTIVE' }
                }
            },
            select: {
                id: true,
                phone: true,
                timezone: true,
                aiPaused: true,
                fullName: true, // Need name for task description
                programs: {
                    where: { status: 'ACTIVE' },
                    include: { template: true },
                    take: 1
                }
            }
        });

        const { messageService } = await import('@/modules/messages/message.service.js');
        const { taskService } = await import('@/modules/tasks/task.service.js');
        const { TaskType, TaskSource, TaskPriority } = await import('@prisma/client');
        const { toZonedTime } = await import('date-fns-tz');

        let remindersSent = 0;

        for (const patient of activePatients) {
            if (patient.aiPaused || !patient.phone || patient.programs.length === 0) continue;

            const program = patient.programs[0];
            const template = program.template;

            // Validate template rules
            if (!template.rules || typeof template.rules !== 'object') {
                logger.warn({ patientId: patient.id, templateId: template.id }, 'Program template has no valid rules JSON');
                continue;
            }

            const rules = template.rules as unknown as ProgramTemplateRules;
            if (!rules.schedule) continue;

            // Calculate details
            const currentDay = this.calculateCurrentDay(program as any, serverNow);

            // Find schedule for today
            const daySchedule = rules.schedule.find(s => s.day === currentDay);
            if (!daySchedule) {
                // No questions for this day, skip
                continue;
            }

            // Local time calculation using Intl (Robust)
            const timeZone = patient.timezone || 'Asia/Almaty';
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone,
                hour: 'numeric',
                minute: 'numeric',
                hour12: false
            });
            const parts = formatter.formatToParts(serverNow);
            const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
            const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

            // Check each activity
            for (const activity of daySchedule.activities) {
                const isMatch = this.isTimeMatch(activity.time, currentHour, currentMinute);

                // Detailed Debug Log (temporary)
                if (patient.fullName?.includes('Ержан') || patient.fullName?.includes('Test')) {
                    logger.info({
                        patient: patient.fullName,
                        tz: timeZone,
                        serverTime: serverNow.toISOString(),
                        currentLocal: `${currentHour}:${currentMinute}`,
                        match: isMatch,
                        activityTime: activity.time
                    }, 'Checking reminder match');
                }

                if (isMatch) {
                    // Start of day for DB queries
                    const startOfDay = new Date(serverNow);
                    startOfDay.setHours(0, 0, 0, 0);

                    // Check if already asked/answered
                    const existingCheckIn = await prisma.checkIn.findFirst({
                        where: {
                            patientId: patient.id,
                            type: activity.type,
                            createdAt: { gte: startOfDay }
                        }
                    });

                    if (!existingCheckIn) {
                        // Check if we ALREADY sent this reminder today (to prevent spam)
                        const existingReminder = await prisma.message.findFirst({
                            where: {
                                patientId: patient.id,
                                sender: 'SYSTEM',
                                content: activity.question, // Exact match on question text
                                createdAt: { gte: startOfDay }
                            }
                        });

                        if (existingReminder) {
                            logger.info({
                                patient: patient.fullName,
                                type: activity.type,
                                msg: 'Reminder already sent today, skipping'
                            }, 'Skipping duplicate reminder');
                            continue;
                        }

                        logger.info({ patient: patient.fullName, type: activity.type }, 'Sending reminder!');
                        try {
                            // 1. Send System Message (via WhatsApp + Save to DB)
                            await messageService.sendSystemMessage(patient.id, activity.question);
                            remindersSent++;

                            logger.info({
                                patientId: patient.id,
                                day: currentDay,
                                type: activity.type
                            }, 'Dynamic Schedule: Question/Reminder sent');

                            // 2. Special Logic for VISITS
                            if (activity.type === 'VISIT') {
                                // Create a task for the tracker
                                await taskService.createTask({
                                    patientId: patient.id,
                                    type: TaskType.VISIT_FOLLOWUP,
                                    title: `Контроль визита: ${patient.fullName}`,
                                    description: `Система отправила напоминание: "${activity.question}". Убедитесь, что пациент придет.`,
                                    priority: TaskPriority.HIGH,
                                    source: TaskSource.SYSTEM,
                                    dueAt: new Date(serverNow.getTime() + 24 * 60 * 60 * 1000) // Follow up tomorrow
                                });
                                logger.info({ patientId: patient.id }, 'Created VISIT_FOLLOWUP task');
                            }
                        } catch (error) {
                            logger.error({ error, patientId: patient.id }, 'Failed to send dynamic reminder');
                        }
                    }
                }
            }
        }

        return remindersSent;
    }

    /**
     * Helper: Check if current time matches scheduled time within a window
     * Window: [Scheduled Time, Scheduled Time + 60 mins]
     */
    /**
     * Try to link an incoming message to a scheduled activity and create a CheckIn
     */
    async linkIncomingToSchedule(patientId: string, text: string, mediaType?: string): Promise<string | null> {
        const candidate = await this.findCandidateActivity(patientId);
        if (candidate) {
            return this.createCheckIn(patientId, candidate.type, text, 'PATIENT');
        }
        return null;
    }

    /**
     * Find a candidate activity that accepts the incoming message
     */
    async findCandidateActivity(patientId: string): Promise<{ type: CheckInType; question: string } | null> {
        // 1. Get active program
        const programInstance = await prisma.programInstance.findFirst({
            where: { patientId, status: 'ACTIVE' },
            include: { template: true }
        });

        if (!programInstance) return null;

        const serverNow = new Date();
        const currentDay = this.calculateCurrentDay(programInstance, serverNow);
        const template = programInstance.template;
        const rules = template.rules as unknown as ProgramTemplateRules;
        const daySchedule = rules.schedule?.find(s => s.day === currentDay);

        if (!daySchedule) return null;

        // 2. Local time
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        const timeZone = patient?.timezone || 'Asia/Almaty';

        // Use Intl for robust hour extraction
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(serverNow);
        const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
        const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

        const startOfDay = new Date(serverNow);
        startOfDay.setHours(0, 0, 0, 0);

        for (const activity of daySchedule.activities) {
            // Loose window: -30 mins to +180 mins
            const isRelevant = this.isTimeMatchExtended(activity.time, currentHour, currentMinute, 180);

            if (isRelevant) {
                // Check if already checked in
                const existing = await prisma.checkIn.findFirst({
                    where: {
                        patientId,
                        type: activity.type,
                        createdAt: { gte: startOfDay }
                    }
                });

                if (!existing) {
                    return { type: activity.type, question: activity.question };
                }
            }
        }
        return null;
    }

    /**
     * Create a check-in manually
     */
    async createCheckIn(patientId: string, type: CheckInType, valueText?: string, source: 'AI' | 'PATIENT' = 'AI'): Promise<string> {
        const checkIn = await prisma.checkIn.create({
            data: {
                patientId,
                type,
                valueText,
                source: source as any
            }
        });
        logger.info({ patientId, type, checkInId: checkIn.id }, 'CheckIn created');
        return checkIn.id;
    }

    private isTimeMatchExtended(scheduledTime: string, currentHour: number, currentMinute: number, windowMinutes: number): boolean {
        const [schedHourStr, schedMinStr] = scheduledTime.split(':');
        const schedHour = parseInt(schedHourStr, 10);
        const schedMin = parseInt(schedMinStr, 10);

        const currentTotal = currentHour * 60 + currentMinute;
        const schedTotal = schedHour * 60 + schedMin;

        const diff = currentTotal - schedTotal;
        // Accept from -30 mins (early) to windowMinutes (late)
        return diff >= -30 && diff <= windowMinutes;
    }

    private isTimeMatch(scheduledTime: string, currentHour: number, currentMinute: number): boolean {
        // Strict window for sending reminders (0 to 60 mins late)
        return this.isTimeMatchExtended(scheduledTime, currentHour, currentMinute, 60) &&
            (currentHour * 60 + currentMinute) >= (parseInt(scheduledTime.split(':')[0]) * 60 + parseInt(scheduledTime.split(':')[1]));
    }
}
// Singleton instance
export const programService = new ProgramService();
