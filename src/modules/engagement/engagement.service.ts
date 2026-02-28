import { prisma } from '@/config/prisma.js';
import { TaskStatus, AlertLevel, TaskType } from '@prisma/client';
import { subDays, isBefore } from 'date-fns';

export interface EngagementScore {
    score: number;
    status: 'OK' | 'AT_RISK' | 'HIGH_RISK';
    factors: string[];
}

export const engagementService = {
    async calculateEngagement(patientId: string): Promise<EngagementScore> {
        let score = 100;
        const factors: string[] = [];
        const now = new Date();

        // 1. Check-ins (Last 3 days)
        const threeDaysAgo = subDays(now, 3);
        const lastCheckIn = await prisma.checkIn.findFirst({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
        });

        if (!lastCheckIn || isBefore(lastCheckIn.createdAt, threeDaysAgo)) {
            score -= 30;
            factors.push('Нет чек-инов более 3 дней');
        } else if (lastCheckIn.createdAt > subDays(now, 1)) {
            // Check-in within last 24h
            score = Math.min(100, score + 20);
            factors.push('Есть свежий чек-ин (+20)');
        }

        // 2. Open Tasks
        const openTasks = await prisma.task.findMany({
            where: {
                patientId,
                status: TaskStatus.OPEN,
            },
        });

        if (openTasks.length > 0) {
            score -= 20;
            factors.push(`Открытых задач: ${openTasks.length}`);
        }

        // 3. Sentiment / Risk (Messages or Alerts)
        // Check last 5 messages for negative sentiment (Risk Level)
        const recentMessages = await prisma.message.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });

        const negativeMessages = recentMessages.filter(
            (m) => m.aiRisk === AlertLevel.HIGH || m.aiRisk === AlertLevel.CRITICAL
        );

        if (negativeMessages.length >= 2) {
            score -= 20;
            factors.push('Негативный настрой в сообщениях');
        } else if (
            recentMessages.length > 0 &&
            recentMessages.every(
                (m) => !m.aiRisk || m.aiRisk === AlertLevel.LOW
            )
        ) {
            score = Math.min(100, score + 10);
            factors.push('Позитивное общение');
        }

        // 4. Overdue Tasks (Reusing simplistic logic for MVP)
        // Assuming we rely on the `isOverdue` logic we mapped in TaskService, 
        // but here we just check raw timestamps for performance or query manually.
        // Let's reuse the rough definition: Created > SLA rule.
        // For simplicity: Any OPEN task created > 24 hours ago contributes to risk?
        // Or strict "Overdue" flag. Let's check for HIGH priority open > 2h
        const overdueTasks = openTasks.filter(t => {
            // Simplified check: Created > 24h ago is bad for engagement context
            return isBefore(t.createdAt, subDays(now, 1));
        });

        if (overdueTasks.length > 0) {
            score -= 10;
            factors.push('Есть просроченные задачи');
        }

        // 5. Reminders sent without response (Approx: Task type MISSED_CHECKIN open)
        const missedCheckinTasks = openTasks.filter(t => t.type === TaskType.MISSED_CHECKIN);
        if (missedCheckinTasks.length >= 2) {
            score -= 10; // "reminders sent >=2 times" logic approximation
            factors.push('Игнорирует напоминания');
        }

        // 6. Closed tasks bonus
        // Check if all tasks were closed in last 7 days? 
        // Or just "Activity bonus". Prompt: "+20 → all tasks closed in last 7 days"
        // Let's check if there ARE tasks in last 7 days and NO open ones.
        const sevenDaysAgo = subDays(now, 7);
        const recentTasks = await prisma.task.findMany({
            where: {
                patientId,
                createdAt: { gte: sevenDaysAgo }
            }
        });

        if (recentTasks.length > 0 && !recentTasks.some(t => t.status === TaskStatus.OPEN)) {
            score = Math.min(100, score + 20);
            factors.push('Все задачи закрыты (+20)');
        }

        // Clamp
        score = Math.max(0, Math.min(100, score));

        let status: EngagementScore['status'] = 'OK';
        if (score < 40) { status = 'HIGH_RISK'; }
        else if (score < 70) { status = 'AT_RISK'; }

        return { score, status, factors };
    },

    async getAnalyticsOverview() {
        const patients = await prisma.patient.findMany({
            select: { id: true }
        });

        // This is heavy for large DB, but MVP requirements say "runtime, no cache".
        // Parallelizing might be needed.
        const scores = await Promise.all(patients.map(p => this.calculateEngagement(p.id)));

        return {
            ok: scores.filter(s => s.status === 'OK').length,
            atRisk: scores.filter(s => s.status === 'AT_RISK').length,
            highRisk: scores.filter(s => s.status === 'HIGH_RISK').length,
        };
    },

    /**
     * Get current hour in patient's timezone
     */
    getLocalHour(timezone: string): number {
        const tz = timezone || 'Asia/Almaty';
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            hour12: false,
        });
        const parts = formatter.formatToParts(new Date());
        return parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    },

    /**
     * Check if current time is within quiet hours (22:00 - 08:00)
     */
    isQuietHours(timezone: string): boolean {
        const hour = this.getLocalHour(timezone);
        return hour >= 22 || hour < 8;
    },

    /**
     * Get start of today in a given timezone (returns UTC Date)
     */
    getStartOfDayInTimezone(timezone: string): Date {
        const tz = timezone || 'Asia/Almaty';
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        // Returns YYYY-MM-DD in the patient's local timezone
        const localDate = formatter.format(now);
        // Parse as start of day in that timezone
        // Create a date string that represents midnight in that timezone
        const midnightLocal = new Date(`${localDate}T00:00:00`);
        // Adjust to UTC: get the timezone offset
        const offsetFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            timeZoneName: 'shortOffset',
        });
        const offsetParts = offsetFormatter.formatToParts(now);
        const offsetStr = offsetParts.find(p => p.type === 'timeZoneName')?.value || '+5';
        const offsetMatch = offsetStr.match(/([+-]?\d+):?(\d+)?/);
        const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 5;
        const offsetMinutes = offsetMatch && offsetMatch[2] ? parseInt(offsetMatch[2], 10) : 0;
        const totalOffsetMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000;

        return new Date(midnightLocal.getTime() - totalOffsetMs);
    },

    /**
     * Check active patients for inactivity and nudge them
     */
    async processReEngagement(): Promise<number> {
        const INACTIVE_THRESHOLD_HOURS = 4;
        const threshold = new Date();
        threshold.setHours(threshold.getHours() - INACTIVE_THRESHOLD_HOURS);

        // Find patients with active programs
        const activePatients = await prisma.patient.findMany({
            where: {
                programs: { some: { status: 'ACTIVE' } },
                aiPaused: false,
            },
            select: {
                id: true,
                fullName: true,
                phone: true,
                timezone: true,
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        // Dynamic import to avoid circular dependencies
        const { messageService } = await import('@/modules/messages/message.service.js');
        const { logger } = await import('@/common/utils/logger.js');

        let nudgesSent = 0;

        for (const patient of activePatients) {
            const patientTz = patient.timezone || 'Asia/Almaty';

            // Quiet hours check: don't disturb between 22:00 - 08:00 local time
            if (this.isQuietHours(patientTz)) {
                continue;
            }

            const lastMsg = patient.messages[0];

            // If patient has no messages OR last message is older than threshold
            const isSilent = !lastMsg || lastMsg.createdAt < threshold;

            if (isSilent) {
                // Check if we already nudged them TODAY (in patient's timezone) to avoid spam
                const startOfDay = this.getStartOfDayInTimezone(patientTz);

                const existingNudge = await prisma.message.findFirst({
                    where: {
                        patientId: patient.id,
                        sender: 'SYSTEM',
                        createdAt: { gte: startOfDay },
                    }
                });

                if (!existingNudge) {
                    try {
                        const nudge = this.getRandomNudge(patient.fullName);
                        logger.info({ patientId: patient.id, localHour: this.getLocalHour(patientTz), lastMsgDate: lastMsg?.createdAt }, 'Sending re-engagement nudge');

                        await messageService.sendSystemMessage(patient.id, nudge);
                        nudgesSent++;
                    } catch (error) {
                        logger.error({ error, patientId: patient.id }, 'Failed to send re-engagement nudge');
                    }
                }
            }
        }

        return nudgesSent;
    },

    getRandomNudge(name: string): string {
        const nudges = [
            `Привет, ${name}! 👋 Как твои дела сегодня?`,
            `${name}, всё ли в порядке? Мы не получали от тебя вестей сегодня.`,
            `Как проходит твой день, ${name}? Не забывай про чек-ины! ✨`,
            `Привет! Если есть вопросы или сложности — я здесь, чтобы помочь. 💙`,
            `${name}, просто хотел узнать, как настроение? 😊`
        ];
        return nudges[Math.floor(Math.random() * nudges.length)];
    }
};
