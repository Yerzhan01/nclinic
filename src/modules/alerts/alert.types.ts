import type { AlertLevel, AlertStatus, AlertType } from '@prisma/client';

export interface AlertListItem {
    id: string;
    patientId: string;
    type: AlertType;
    level: AlertLevel;
    status: AlertStatus;
    title: string;
    description: string | null;
    source: string;
    createdAt: Date;
    patient: {
        id: string;
        fullName: string;
        phone: string;
        chatMode: string;
    };
}

export interface AlertWithPatient {
    id: string;
    patientId: string;
    type: AlertType;
    level: AlertLevel;
    status: AlertStatus;
    title: string;
    description: string | null;
    source: string;
    messageId: string | null;
    resolvedAt: Date | null;
    resolvedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    patient: {
        id: string;
        fullName: string;
        phone: string;
        chatMode: string;
    };
    message?: {
        id: string;
        content: string | null;
        createdAt: Date;
    } | null;
}

export interface CreateAlertFromAIInput {
    patientId: string;
    messageId?: string;
    type: AlertType;
    level: AlertLevel;
    title: string;
    description?: string;
}

export interface ListAlertsFilters {
    status?: AlertStatus;
    level?: AlertLevel;
    patientId?: string;
    limit?: number;
    offset?: number;
}

export interface ResolveAlertDto {
    alertId: string;
    userId: string;
    note?: string;
}
