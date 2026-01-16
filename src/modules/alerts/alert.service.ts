import { AlertStatus, AlertLevel, ChatMode, TaskType, TaskPriority, TaskSource } from '@prisma/client';
import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import { AppError } from '@/common/errors/AppError.js';
import type {
    CreateAlertFromAIInput,
    ListAlertsFilters,
    AlertListItem,
    AlertWithPatient,
} from './alert.types.js';
import { amoCRMService } from '@/integrations/amocrm/amocrm.service.js';

export class AlertService {
    /**
     * Create an alert from AI analysis
     * Handles deduplication: if HIGH/CRITICAL alert exists in last 24h, update it
     * Switches patient to HUMAN mode if needed
     */
    async createFromAI(input: CreateAlertFromAIInput): Promise<AlertWithPatient> {
        const { patientId, messageId, type, level, title, description } = input;

        // Check for existing HIGH/CRITICAL alert in last 24 hours
        if (level === AlertLevel.HIGH || level === AlertLevel.CRITICAL) {
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

            const existingAlert = await prisma.alert.findFirst({
                where: {
                    patientId,
                    status: AlertStatus.OPEN,
                    level: { in: [AlertLevel.HIGH, AlertLevel.CRITICAL] },
                    createdAt: { gte: twentyFourHoursAgo },
                },
                include: {
                    patient: true,
                    message: true,
                },
            });

            if (existingAlert) {
                // Update existing alert instead of creating duplicate
                const updatedDescription = description
                    ? `${existingAlert.description || ''}\n---\n${description}`
                    : existingAlert.description;

                const updated = await prisma.alert.update({
                    where: { id: existingAlert.id },
                    data: {
                        description: updatedDescription,
                        // Update level if new one is more severe
                        level: level === AlertLevel.CRITICAL ? AlertLevel.CRITICAL : existingAlert.level,
                    },
                    include: {
                        patient: true,
                        message: true,
                    },
                });

                logger.info(
                    { alertId: updated.id, patientId },
                    'Alert updated (duplicate prevention)'
                );

                return this.mapToAlertWithPatient(updated);
            }
        }

        // Check if patient needs to switch to HUMAN mode
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
        });

        if (!patient) {
            throw AppError.notFound('Patient not found');
        }

        const shouldSwitchToHuman =
            patient.chatMode !== ChatMode.HUMAN &&
            (level === AlertLevel.HIGH || level === AlertLevel.CRITICAL || type === 'REQUEST_MANAGER');

        // Create alert and optionally update patient in transaction
        const [alert] = await prisma.$transaction([
            prisma.alert.create({
                data: {
                    patientId,
                    type,
                    level,
                    status: AlertStatus.OPEN,
                    title,
                    description,
                    source: 'ai',
                    messageId,
                },
                include: {
                    patient: true,
                    message: true,
                },
            }),
            ...(shouldSwitchToHuman
                ? [
                    prisma.patient.update({
                        where: { id: patientId },
                        data: {
                            chatMode: ChatMode.HUMAN,
                            chatModeSetAt: new Date(),
                            chatModeSetBy: 'system',
                        },
                    }),
                ]
                : []),
        ]);

        logger.info(
            { alertId: alert.id, patientId, level, switchedToHuman: shouldSwitchToHuman },
            'Alert created from AI'
        );

        // Create task from alert (import dynamically to avoid circular dependency)
        try {
            const { taskService } = await import('@/modules/tasks/task.service.js');
            // Map alert type/level to task type/priority
            let taskType: TaskType = TaskType.CUSTOM;
            if (alert.level === 'HIGH' || alert.level === 'CRITICAL') taskType = TaskType.RISK_ALERT;
            if (alert.type === 'MISSED_CHECKIN') taskType = TaskType.MISSED_CHECKIN;

            let priority: TaskPriority = TaskPriority.MEDIUM;
            if (alert.level === 'HIGH') priority = TaskPriority.HIGH;
            if (alert.level === 'CRITICAL') priority = TaskPriority.HIGH; // No URGENT anymore

            await taskService.createTask({
                patientId: alert.patientId,
                type: taskType,
                priority: priority,
                title: alert.title,
                description: alert.description || undefined,
                source: TaskSource.SYSTEM, // Alert service acts as system/operator
                alertId: alert.id,
            });
        } catch (error) {
            logger.error({ error, alertId: alert.id }, 'Failed to create task from alert');
            // Don't fail the alert creation if task creation fails
        }

        // Add note to amoCRM if patient has lead ID
        if (alert.patient.amoLeadId) {
            // Non-blocking note
            amoCRMService.addNote(
                alert.patient.amoLeadId,
                `⚠️ Alert [${alert.level}]: ${alert.title}\n${alert.description || ''}`
            ).catch(err => logger.error({ err }, 'Failed to add amoCRM note'));

            // Sync state if High/Critical
            if (alert.level === AlertLevel.HIGH || alert.level === AlertLevel.CRITICAL) {
                amoCRMService.syncPatientState(alert.patientId, 'RISK_HIGH')
                    .catch(err => logger.error({ err }, 'Failed to sync amoCRM state for risk'));
            }
        }

        return this.mapToAlertWithPatient(alert);
    }

    /**
     * List active (non-resolved) alerts
     */
    async listActive(filters: ListAlertsFilters): Promise<AlertListItem[]> {
        const { status, level, patientId, limit = 50, offset = 0 } = filters;

        const alerts = await prisma.alert.findMany({
            where: {
                status: status || { not: AlertStatus.RESOLVED },
                ...(level && { level }),
                ...(patientId && { patientId }),
            },
            include: {
                patient: {
                    select: {
                        id: true,
                        fullName: true,
                        phone: true,
                        chatMode: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });

        return alerts.map((a) => ({
            id: a.id,
            patientId: a.patientId,
            type: a.type,
            level: a.level,
            status: a.status,
            title: a.title,
            description: a.description,
            source: a.source,
            createdAt: a.createdAt,
            patient: {
                id: a.patient.id,
                fullName: a.patient.fullName,
                phone: a.patient.phone,
                chatMode: a.patient.chatMode,
            },
        }));
    }

    /**
     * Get alert by ID with patient and message
     */
    async getById(id: string): Promise<AlertWithPatient | null> {
        const alert = await prisma.alert.findUnique({
            where: { id },
            include: {
                patient: true,
                message: true,
            },
        });

        if (!alert) {
            return null;
        }

        return this.mapToAlertWithPatient(alert);
    }

    /**
     * Resolve an alert and switch patient back to AI mode
     */
    async resolve(
        alertId: string,
        userId: string,
        note?: string
    ): Promise<AlertWithPatient> {
        const alert = await prisma.alert.findUnique({
            where: { id: alertId },
            include: { patient: true },
        });

        if (!alert) {
            throw AppError.notFound('Alert not found');
        }

        if (alert.status === AlertStatus.RESOLVED) {
            throw AppError.badRequest('Alert is already resolved');
        }

        // Update alert and patient in transaction
        const [updatedAlert] = await prisma.$transaction([
            prisma.alert.update({
                where: { id: alertId },
                data: {
                    status: AlertStatus.RESOLVED,
                    resolvedAt: new Date(),
                    resolvedBy: userId,
                    description: note ? `${alert.description || ''}\n---\nResolve note: ${note}` : alert.description,
                },
                include: {
                    patient: true,
                    message: true,
                },
            }),
            prisma.patient.update({
                where: { id: alert.patientId },
                data: {
                    chatMode: ChatMode.AI,
                    chatModeSetAt: new Date(),
                    chatModeSetBy: userId,
                },
            }),
        ]);

        logger.info(
            { alertId, userId, patientId: alert.patientId },
            'Alert resolved, patient returned to AI mode'
        );

        return this.mapToAlertWithPatient(updatedAlert);
    }

    private mapToAlertWithPatient(alert: {
        id: string;
        patientId: string;
        type: string;
        level: string;
        status: string;
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
    }): AlertWithPatient {
        return {
            id: alert.id,
            patientId: alert.patientId,
            type: alert.type as AlertWithPatient['type'],
            level: alert.level as AlertWithPatient['level'],
            status: alert.status as AlertWithPatient['status'],
            title: alert.title,
            description: alert.description,
            source: alert.source,
            messageId: alert.messageId,
            resolvedAt: alert.resolvedAt,
            resolvedBy: alert.resolvedBy,
            createdAt: alert.createdAt,
            updatedAt: alert.updatedAt,
            patient: {
                id: alert.patient.id,
                fullName: alert.patient.fullName,
                phone: alert.patient.phone,
                chatMode: alert.patient.chatMode,
            },
            message: alert.message
                ? {
                    id: alert.message.id,
                    content: alert.message.content,
                    createdAt: alert.message.createdAt,
                }
                : null,
        };
    }
}

// Singleton instance
export const alertService = new AlertService();
