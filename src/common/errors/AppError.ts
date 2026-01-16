export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        isOperational: boolean = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;

        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    // Factory methods for common errors
    static badRequest(message: string, code = 'BAD_REQUEST'): AppError {
        return new AppError(message, 400, code);
    }

    static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED'): AppError {
        return new AppError(message, 401, code);
    }

    static forbidden(message = 'Forbidden', code = 'FORBIDDEN'): AppError {
        return new AppError(message, 403, code);
    }

    static notFound(message = 'Not found', code = 'NOT_FOUND'): AppError {
        return new AppError(message, 404, code);
    }

    static conflict(message: string, code = 'CONFLICT'): AppError {
        return new AppError(message, 409, code);
    }

    static internal(message = 'Internal server error', code = 'INTERNAL_ERROR'): AppError {
        return new AppError(message, 500, code, false);
    }
}
