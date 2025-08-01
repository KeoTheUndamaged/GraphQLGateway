/**
 * Builds a standardised error response object
 *
 * Creates a consistent error response structure with:
 * - Unique error ID for tracking
 * - Categorized error type (ClientError/ServerError)
 * - Standardised error codes
 * - Environment-appropriate error messages
 * - Debug information in non-production environments
 *
 * @param err - Original error object
 * @param statusCode - HTTP status code for the error
 * @param errorId - Unique identifier for this error occurrence
 * @returns Formatted error response object
 */
import {serverConfiguration} from '../managers/environmentManager';

export const buildErrorResponse = (err: Error, statusCode: number, errorId: string): ErrorResponse => {
    const baseResponse = {
        error: {
            id: errorId,
            type: getErrorType(statusCode),
            code: getErrorCode(err, statusCode),
            message: getSafeErrorMessage(err, statusCode),
        }
    }

    if (serverConfiguration.nodeEnv !== 'production') {
        return {
            ...baseResponse,
            debug: {
                name: err.name,
                message: err.message,
                stack: err.stack,
                cause: err.cause,
            }
        }
    }
    return baseResponse;
}

/**
 * Categorises errors by HTTP status code range
 *
 * Provides semantic error type classification:
 * - 4xx codes = ClientError (client-side issues)
 * - 5xx codes = ServerError (server-side issues)
 * - Other codes = Generic Error
 *
 * @param statusCode - HTTP status code
 * @returns Human-readable error type string
 */
export const getErrorType = (statusCode: number): string => {
    if (statusCode >= 400 && statusCode < 500) return 'ClientError';
    if (statusCode >= 500) return 'ServerError';
    return 'Error';
}

/**
 * Maps errors to standardised error codes
 *
 * Provides consistent error codes for:
 * 1. Named error types (ValidationError, GraphQLError, etc.)
 * 2. HTTP status code fallbacks
 *
 * Benefits:
 * - Client applications can handle errors programmatically
 * - Consistent error categorisation across services
 * - API documentation and error handling
 *
 * @param err - Error object
 * @param statusCode - HTTP status code
 * @returns Standardized error code string
 */
export const getErrorCode = (err: Error, statusCode: number): string => {
    const errorCodeMap: Record<string, string> = {
        'ValidationError': 'VALIDATION_FAILED',
        'GraphQLError': 'GRAPHQL_ERROR',
        'AuthenticationError': 'AUTHENTICATION_REQUIRED',
        'ForbiddenError': 'ACCESS_FORBIDDEN',
        'TimeoutError': 'REQUEST_TIMEOUT',
        'TooManyRequestsError': 'RATE_LIMIT_EXCEEDED',
    }
    if (errorCodeMap[err.name]) {
        return errorCodeMap[err.name] || 'INTERNAL_SERVER_ERROR';
    }
    // Fallback to status-code-based codes
    switch (statusCode) {
        case 400: return 'BAD_REQUEST';
        case 401: return 'UNAUTHORIZED';
        case 403: return 'FORBIDDEN';
        case 404: return 'NOT_FOUND';
        case 429: return 'TOO_MANY_REQUESTS';
        case 500: return 'INTERNAL_SERVER_ERROR';
        case 502: return 'BAD_GATEWAY';
        case 503: return 'SERVICE_UNAVAILABLE';
        case 504: return 'GATEWAY_TIMEOUT';
        default: return 'UNKNOWN_ERROR';
    }

}

/**
 * Generates safe error messages for client consumption
 *
 * Security-conscious message filtering:
 * - Production + 5xx errors: Generic messages (prevent information disclosure)
 * - Development OR 4xx errors: Actual error messages (debugging/user feedback)
 *
 * This prevents sensitive server information from leaking in production
 * while maintaining useful error messages for client errors and development.
 *
 * @param err - Error object
 * @param statusCode - HTTP status code
 * @returns Safe error message for the client
 */
export const getSafeErrorMessage = (err: Error, statusCode: number ): string => {
    if (serverConfiguration.nodeEnv === 'production' && statusCode >= 500) {
        const genericMessages: Record<number, string> = {
            500: 'An internal server error occurred',
            502: 'Bad gateway',
            503: 'Service temporarily unavailable',
            504: 'Gateway timeout',
        }
        return genericMessages[statusCode] || 'An unexpected error occurred';
    }
    return err.message || 'An unexpected error occurred';
}

/**
 * Generates unique error identifier for tracking and correlation
 *
 * Format: err_${timestamp}_${randomString}
 * - Timestamp: Milliseconds since epoch (sortable, time-based)
 * - Random string: Base36 encoding for URL-safe characters
 *
 * Use cases:
 * - Log correlation between client and server
 * - Support ticket references
 * - Debugging specific error occurrences
 * - Monitoring and alerting correlation
 *
 * @returns Unique error identifier string
 */
export const generateErrorId = (): string => {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Maps error types to appropriate HTTP status codes
 *
 * Provides intelligent status code assignment based on:
 * 1. Error constructor name (ValidationError, GraphQLError, etc.)
 * 2. Default fallback to 500 for unknown errors
 *
 * This ensures proper HTTP semantics for different error types,
 * enabling correct client-side error handling and caching behaviour.
 *
 * @param err - Error object
 * @returns Appropriate HTTP status code
 */
export const determineStatusCode = (err: Error): number => {
    // Standard error mappings
    const statusMap: Record<string, number> = {
        'ValidationError': 400,
        'GraphQLError': 400,
        'SyntaxError': 400,
        'AuthenticationError': 401,
        'ForbiddenError': 403,
        'NotFoundError': 404,
        'TimeoutError': 504,
        'TooManyRequestsError': 429,
    };

    return statusMap[err.name] || 500;
}

interface ErrorResponse {
    error: {
        id: string;
        type: string;
        code: string;
        message: string;
    };
    debug?: {
        name: string;
        message: string;
        stack: string | undefined;
        cause: unknown;
    };
}