import {Logger} from '../managers/loggerManager';
import {NextFunction, Request, Response} from 'express';
import {buildErrorResponse, determineStatusCode, generateErrorId} from '../utils/errorHandlerFunctions';

/**
 * Express Error Handler Factory
 *
 * Creates centralised error handling middleware that:
 * - Follows Express.js 4-parameter error handler signature
 * - Provides a consistent error response format across the application
 * - Implements security-conscious error message filtering
 * - Generates unique error IDs for debugging and correlation
 * - Adapts behaviour based on NODE_ENV (production vs development)
 *
 * CRITICAL: Must be registered as the LAST middleware in Express app
 * Express identifies error handlers by their 4-parameter signature
 */
export const createErrorHandler = (logger: Logger) => {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            return next(err);
        }

        const statusCode: number = determineStatusCode(err);
        const errorId: string = generateErrorId();

        logger.error('Error Occurred', {
            error: {
                id: errorId,
                name: err.name,
                message: err.message,
                stack: err.stack,
            },
            request: {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
            },
            response: {
                statusCode,
            }
        });
        const errorResponse = buildErrorResponse(err, statusCode, errorId);
        res.status(statusCode).json(errorResponse);
    }
}
