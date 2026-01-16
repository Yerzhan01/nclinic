import { prisma } from '@/config/prisma.js';
import { AppError } from '@/common/errors/AppError.js';
import { logger } from '@/common/utils/logger.js';
import { TaskStatus, TaskType, TaskPriority, TaskSource } from '@prisma/client';

export interface CreateTaskInput {
    patientId: string;
    type: TaskType;
    priority?: TaskPriority;
    title: string;
    description?: string;
    source: TaskSource;
    meta?: any;
    alertId?: string;
    dueAt?: Date;
}

export interface UpdateTaskInput {
    status?: TaskStatus;
    note?: string;
}

export interface TaskFilter {
    status?: TaskStatus;
    patientId?: string;
    priority?: TaskPriority;
    overdue?: boolean; // New filter
}

export interface TaskWithSLA {
    // Basic Task fields + Patient
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    type: TaskType;
    source: TaskSource;
    createdAt: Date;
    resolvedAt: Date | null;
    patient: {
        id: string;
        fullName: string;
        phone: string;
    };
    // SLA Computed fields
    slaHours: number;
    isOverdue: boolean;
    overdueHours: number;
}

const SLA_RULES_MS = {
    [TaskPriority.HIGH]: 2 * 60 * 60 * 1000,    // 2 hours
    [TaskPriority.MEDIUM]: 24 * 60 * 60 * 1000, // 24 hours
    [TaskPriority.LOW]: 72 * 60 * 60 * 1000,    // 72 hours
};


export class TaskService {
    /**
     * Create a new task with duplicate prevention
     */
    async createTask(input: CreateTaskInput) {
        // 1. Duplicate Check: 24h window for same type & patient
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const existingTask = await prisma.task.findFirst({
            where: {
                patientId: input.patientId,
                type: input.type,
                status: TaskStatus.OPEN,
                createdAt: {
                    gte: twentyFourHoursAgo,
                },
            },
        });

        if (existingTask) {
            logger.info(
                { patientId: input.patientId, type: input.type, existingTaskId: existingTask.id },
                'Skipped creating duplicate task'
            );
            return existingTask;
        }

        // 2. Create Task
        const task = await prisma.task.create({
            data: {
                patientId: input.patientId,
                type: input.type,
                priority: input.priority || TaskPriority.MEDIUM,
                title: input.title,
                description: input.description,
                source: input.source,
                meta: input.meta || {},
                alertId: input.alertId,
                status: TaskStatus.OPEN,
                dueAt: input.dueAt,
            },
        });

        logger.info({ taskId: task.id, patientId: input.patientId, type: input.type }, 'Task created');
        return task;
    }

    /**
     * List tasks with filters
     */
    async listTasks(filter: TaskFilter) {
        const tasks = await prisma.task.findMany({
            where: {
                status: filter.status,
                patientId: filter.patientId,
                priority: filter.priority,
            },
            include: {
                patient: {
                    select: {
                        id: true,
                        fullName: true,
                        phone: true,
                    },
                },
            },
            orderBy: [
                { priority: 'desc' }, // High priority first
                { createdAt: 'desc' }, // Newest first
            ],
        });

        // Compute SLA fields
        const tasksWithSLA = tasks.map(this.calculateSLA);

        // Apply overdue filter if requested
        if (filter.overdue) {
            return tasksWithSLA.filter(t => t.isOverdue);
        }

        return tasksWithSLA;
    }

    /**
     * Runtime SLA Calculation
     */
    private calculateSLA(task: any): TaskWithSLA {
        const slaMs = SLA_RULES_MS[task.priority as TaskPriority] || SLA_RULES_MS[TaskPriority.MEDIUM];

        let elapsedMs = 0;
        if (task.status === TaskStatus.DONE && task.resolvedAt) {
            elapsedMs = task.resolvedAt.getTime() - task.createdAt.getTime();
        } else {
            elapsedMs = Date.now() - task.createdAt.getTime();
        }

        const isOverdue = task.status !== TaskStatus.DONE && elapsedMs > slaMs;
        const overdueHours = isOverdue ? Math.floor((elapsedMs - slaMs) / (60 * 60 * 1000)) : 0;

        return {
            ...task,
            slaHours: slaMs / (60 * 60 * 1000),
            isOverdue,
            overdueHours
        };
    }

    /**
     * Update task status
     */
    async updateTask(id: string, input: UpdateTaskInput) {
        const task = await prisma.task.findUnique({ where: { id } });
        if (!task) {
            throw AppError.notFound('Task not found');
        }

        const data: any = {};
        if (input.status) {
            data.status = input.status;
            if (input.status === TaskStatus.IN_PROGRESS && !task.startedAt) {
                data.startedAt = new Date();
            }
            if (input.status === TaskStatus.DONE && !task.resolvedAt) {
                data.resolvedAt = new Date();
                data.completedAt = new Date();
            }
        }

        return prisma.task.update({
            where: { id },
            data,
        });
    }

    /**
     * Get tasks for a specific patient
     */
    async getPatientTasks(patientId: string) {
        // We reuse listTasks so SLA is included
        return this.listTasks({ patientId, status: TaskStatus.OPEN });
    }
}

export const taskService = new TaskService();
