/**
 * Standard API response format
 */

export interface SuccessResponse<T> {
    success: true;
    data: T;
    meta?: Record<string, unknown>;
}

export interface ErrorResponse {
    success: false;
    error: string;
    code?: string;
    meta?: Record<string, unknown>;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Create a success response
 */
export function successResponse<T>(data: T, meta?: Record<string, unknown>): SuccessResponse<T> {
    return {
        success: true,
        data,
        ...(meta && { meta }),
    };
}

/**
 * Create an error response
 */
export function errorResponse(
    error: string,
    code?: string,
    meta?: Record<string, unknown>
): ErrorResponse {
    return {
        success: false,
        error,
        ...(code && { code }),
        ...(meta && { meta }),
    };
}
