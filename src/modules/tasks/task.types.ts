import type { TaskStatus, TaskType, TaskPriority } from '@prisma/client';

export interface CreateTaskDto {
    patientId: string;
    alertId?: string;
    type: TaskType;
    priority?: TaskPriority;
    title: string;
    note?: string;
    assignedToId?: string;
    dueAt?: Date;
}

export interface UpdateTaskStatusDto {
    status: 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}

export interface TaskListFilters {
    status?: TaskStatus;
    assignedToId?: string;
    patientId?: string;
    alertId?: string;
    overdue?: boolean;
    limit?: number;
    offset?: number;
}

export interface TaskListItem {
    id: string;
    patientId: string;
    alertId: string | null;
    type: TaskType;
    status: TaskStatus;
    priority: TaskPriority;
    title: string;
    assignedToId: string | null;
    dueAt: Date | null;
    createdAt: Date;
    patient: {
        id: string;
        fullName: string;
        phone: string;
    };
}

export interface TaskWithDetails extends TaskListItem {
    note: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
    alert?: {
        id: string;
        title: string;
        level: string;
        status: string;
    } | null;
}
