export type TaskType = 'RISK_ALERT' | 'MISSED_CHECKIN' | 'FOLLOW_UP' | 'CUSTOM';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskSource = 'SYSTEM' | 'MANUAL' | 'AI';

export interface Task {
    id: string;
    patientId: string;
    type: TaskType;
    status: TaskStatus;
    priority: TaskPriority;
    source: TaskSource;
    title: string;
    description?: string | null;
    alertId?: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string | null;
    resolvedBy?: string | null;
    patient?: {
        id: string;
        fullName: string;
        phone: string;
    };
    // SLA Runtime Fields
    slaHours?: number;
    isOverdue?: boolean;
    overdueHours?: number;
}

export interface TaskFilters {
    status?: TaskStatus;
    priority?: TaskPriority;
    patientId?: string;
    search?: string;
    overdue?: boolean;
}

export interface CreateTaskInput {
    patientId: string;
    type: TaskType;
    title: string;
    description?: string;
    priority?: TaskPriority;
}
