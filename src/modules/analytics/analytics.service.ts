import { prisma } from '@/config/prisma.js';
import { TaskStatus, TaskPriority, TaskType, AlertLevel } from '@prisma/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

interface AnalyticsFilters {
    from?: string;
    to?: string;
}

// SLA Rules (duplicated for now, ideally shared constant)
const SLA_RULES_MS = {
    [TaskPriority.HIGH]: 2 * 60 * 60 * 1000,
    [TaskPriority.MEDIUM]: 24 * 60 * 60 * 1000,
    [TaskPriority.LOW]: 72 * 60 * 60 * 1000,
};

export class AnalyticsService {
    /**
     * Get high-level overview metrics
     */
    async getOverview(filters: AnalyticsFilters) {
        const dateFilter = this.getDateFilter(filters);

        // Task Aggregations
        const totalTasks = await prisma.task.count({ where: { createdAt: dateFilter } });
        const openTasks = await prisma.task.count({ where: { status: TaskStatus.OPEN, createdAt: dateFilter } });
        const inProgressTasks = await prisma.task.count({ where: { status: TaskStatus.IN_PROGRESS, createdAt: dateFilter } });
        const doneTasks = await prisma.task.count({ where: { status: TaskStatus.DONE, createdAt: dateFilter } });

        // Calculate Average Resolution Time for DONE tasks
        const resolvedTasks = await prisma.task.findMany({
            where: {
                status: TaskStatus.DONE,
                createdAt: dateFilter,
                resolvedAt: { not: null }
            },
            select: { createdAt: true, resolvedAt: true }
        });

        let totalResolutionTimeMs = 0;
        resolvedTasks.forEach(task => {
            if (task.resolvedAt) {
                totalResolutionTimeMs += task.resolvedAt.getTime() - task.createdAt.getTime();
            }
        });
        const avgResolutionHours = resolvedTasks.length > 0
            ? (totalResolutionTimeMs / resolvedTasks.length / (1000 * 60 * 60)).toFixed(1)
            : 0;

        // Risk Aggregations (Tasks of type RISK_ALERT)
        const totalRisks = await prisma.task.count({
            where: {
                type: TaskType.RISK_ALERT,
                createdAt: dateFilter
            }
        });

        const highRisks = await prisma.task.count({
            where: {
                type: TaskType.RISK_ALERT,
                priority: TaskPriority.HIGH,
                createdAt: dateFilter
            }
        });

        const criticalRisks = await prisma.task.count({
            where: {
                type: TaskType.RISK_ALERT,
                priority: { in: [TaskPriority.HIGH, TaskPriority.HIGH /* Using available enums, URGENT missing in schema? */] } as any,
                // Wait, schema has LOW, MEDIUM, HIGH. No URGENT. I should check schema again.
                // Schema: LOW, MEDIUM, HIGH. No URGENT.
                // Resetting critical to just HIGH for now or using HIGH as proxy.
                createdAt: dateFilter
            }
        });

        // Calculate Overdue Metrics (Runtime)
        // We need to fetch ALL open tasks to check overdue status, 
        // as database query for "createdAt + SLA < now" depends on priority.
        const allOpenTasks = await prisma.task.findMany({
            where: {
                status: TaskStatus.OPEN,
                createdAt: dateFilter
            },
            select: { createdAt: true, priority: true }
        });

        let overdueTotal = 0;
        let overdueHigh = 0;

        const now = Date.now();
        for (const t of allOpenTasks) {
            const sla = SLA_RULES_MS[t.priority] || SLA_RULES_MS[TaskPriority.MEDIUM];
            if (now - t.createdAt.getTime() > sla) {
                overdueTotal++;
                if (t.priority === TaskPriority.HIGH) {
                    overdueHigh++;
                }
            }
        }

        return {
            tasks: {
                total: totalTasks,
                open: openTasks,
                inProgress: inProgressTasks,
                done: doneTasks,
                avgResolutionHours: Math.round(Number(avgResolutionHours) * 10) / 10
            },
            risks: {
                total: totalRisks,
                high: highRisks,
                critical: criticalRisks
            },
            overdue: {
                total: overdueTotal,
                high: overdueHigh
            }
        };
    }

    /**
     * Get tasks grouped by day
     */
    async getTasksByDay(filters: AnalyticsFilters) {
        // We'll limit to last 30 days max for performance if not specified
        const endDate = filters.to ? endOfDay(new Date(filters.to)) : endOfDay(new Date());
        const startDate = filters.from ? startOfDay(new Date(filters.from)) : subDays(endDate, 30);

        // Group by date logic is DB specific usually, but here we can fetch and aggregate in JS for simplicity
        // or use raw query. For MVP, fetching simplified list is safer across DBs unless we use Prisma Raw.
        // Let's use Prisma groupBy if supported, or just count per day iteration for safety on smaller datasets.

        // Efficient approach: Prisma groupBy is great but date truncation support varies by provider (Postgres vs SQLite)
        // Since we are likely on Postgres, we could use raw query, but to stay ORM-pure:
        // We will fetch all tasks in range (lite select) and aggregate in memory.
        // Assuming < 10k tasks per month, this is fine.

        const tasks = await prisma.task.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                createdAt: true,
                status: true
            }
        });

        const map = new Map<string, { date: string; open: number; done: number; total: number }>();

        // Initialize map with all days in range to fill gaps
        let current = startDate;
        while (current <= endDate) {
            const dayKey = format(current, 'yyyy-MM-dd');
            map.set(dayKey, { date: dayKey, open: 0, done: 0, total: 0 });
            current = new Date(current.getTime() + 24 * 60 * 60 * 1000); // +1 day
        }

        tasks.forEach(task => {
            const dayKey = format(task.createdAt, 'yyyy-MM-dd');
            const entry = map.get(dayKey);
            if (entry) {
                entry.total++;
                if (task.status === TaskStatus.DONE) {
                    entry.done++;
                } else {
                    entry.open++;
                }
            }
        });

        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Identify problem patients based on heuristics
     */
    async getProblemPatients(limit = 10) {
        // Criteria:
        // 1. > 2 RISK_ALERT tasks
        // OR
        // 2. > 3 OPEN tasks
        // OR
        // 3. Has OPEN task older than 48h

        // We can do this by fetching patients with their active task counts
        // Prisma doesn't support complex "OR across aggregations" easily in one go.
        // We will fetch candidates and filter.

        const patients = await prisma.patient.findMany({
            select: {
                id: true,
                fullName: true,
                tasks: {
                    where: {
                        OR: [
                            { status: { not: TaskStatus.DONE } },
                            { type: TaskType.RISK_ALERT }
                        ]
                    },
                    select: {
                        id: true,
                        type: true,
                        status: true,
                        createdAt: true,
                        priority: true
                    }
                }
            }
        });

        const problematic = patients.map((p: any) => {
            const openTasks = p.tasks.filter((t: any) => t.status !== TaskStatus.DONE);
            const riskTasks = p.tasks.filter((t: any) => t.type === TaskType.RISK_ALERT);

            const oldestOpenTask = openTasks.sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime())[0];
            const oldestOpenHours = oldestOpenTask
                ? (Date.now() - oldestOpenTask.createdAt.getTime()) / (1000 * 60 * 60)
                : 0;

            const isProblematic =
                riskTasks.length >= 2 ||
                openTasks.length >= 3 ||
                oldestOpenHours > 48;

            if (!isProblematic) return null;

            return {
                patientId: p.id,
                patientName: p.fullName,
                openTasks: openTasks.length,
                riskAlerts: riskTasks.length,
                oldestTaskHours: Math.round(oldestOpenHours),
                // Score for sorting severe cases first
                score: (riskTasks.length * 10) + (openTasks.length * 2) + (oldestOpenHours / 24)
            };
        })
            .filter(p => p !== null)
            // @ts-ignore
            .sort((a, b) => b!.score - a!.score)
            .slice(0, limit);

        return problematic;
    }

    private getDateFilter(filters: AnalyticsFilters) {
        if (!filters.from && !filters.to) return {};

        return {
            gte: filters.from ? startOfDay(new Date(filters.from)) : undefined,
            lte: filters.to ? endOfDay(new Date(filters.to)) : undefined
        };
    }
}

export const analyticsService = new AnalyticsService();
