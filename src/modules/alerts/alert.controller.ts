import type { FastifyRequest, FastifyReply } from 'fastify';
import {
    alertIdParamSchema,
    resolveAlertSchema,
    listAlertsQuerySchema,
} from './alert.schema.js';
import { alertService } from './alert.service.js';
import { successResponse } from '@/common/utils/response.js';
import { AppError } from '@/common/errors/AppError.js';

export class AlertController {
    /**
     * GET /alerts - List active alerts
     */
    async listAlerts(request: FastifyRequest, reply: FastifyReply) {
        const query = listAlertsQuerySchema.parse(request.query);

        const alerts = await alertService.listActive({
            status: query.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | undefined,
            level: query.level as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined,
            patientId: query.patientId,
            limit: query.limit,
            offset: query.offset,
        });

        return reply.send(
            successResponse(alerts, {
                count: alerts.length,
                limit: query.limit,
                offset: query.offset,
            })
        );
    }

    /**
     * GET /alerts/:id - Get alert by ID
     */
    async getAlert(request: FastifyRequest, reply: FastifyReply) {
        const { id } = alertIdParamSchema.parse(request.params);

        const alert = await alertService.getById(id);

        if (!alert) {
            throw AppError.notFound('Alert not found');
        }

        return reply.send(successResponse(alert));
    }

    /**
     * POST /alerts/:id/resolve - Resolve an alert
     */
    async resolveAlert(request: FastifyRequest, reply: FastifyReply) {
        const { id } = alertIdParamSchema.parse(request.params);
        const body = resolveAlertSchema.parse(request.body);

        // Get user ID from JWT
        const user = request.user;
        if (!user) {
            throw AppError.unauthorized('User not authenticated');
        }

        const alert = await alertService.resolve(id, user.id, body.note);

        return reply.send(successResponse(alert));
    }
}

export const alertController = new AlertController();
