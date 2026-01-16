import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './AppError.js';
import { errorResponse } from '@/common/utils/response.js';
import { isDev } from '@/config/env.js';

export function setupErrorHandler(app: FastifyInstance): void {
    app.setErrorHandler(
        (error: FastifyError | AppError | ZodError | Error, request: FastifyRequest, reply: FastifyReply) => {
            const { log } = request;

            // Handle AppError
            if (error instanceof AppError) {
                log.warn({ err: error }, `AppError: ${error.message}`);
                return reply.status(error.statusCode).send(
                    errorResponse(error.message, error.code)
                );
            }

            // Handle Zod validation errors
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                }));
                log.warn({ errors: formattedErrors }, 'Validation error');
                return reply.status(400).send(
                    errorResponse('Validation error', 'VALIDATION_ERROR', { errors: formattedErrors })
                );
            }

            // Handle Fastify validation errors
            if ('validation' in error && error.validation) {
                log.warn({ err: error }, 'Fastify validation error');
                return reply.status(400).send(
                    errorResponse(error.message, 'VALIDATION_ERROR')
                );
            }

            // Handle JWT errors
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                log.warn({ err: error }, 'JWT error');
                return reply.status(401).send(
                    errorResponse('Invalid or expired token', 'INVALID_TOKEN')
                );
            }

            // Log unexpected errors
            log.error({ err: error }, 'Unexpected error');

            // In production, hide internal error details
            const message = isDev ? error.message : 'Internal server error';
            return reply.status(500).send(
                errorResponse(message, 'INTERNAL_ERROR')
            );
        }
    );
}
