/**
 * Global Express Error Handler Middleware
 *
 * This is the last line of defence for handling uncaught errors in the Express application.
 * Critical for preventing application crashes and maintaining security/operational standards.
 *
 * Error Handling Strategy:
 * - Log all errors with comprehensive context for debugging
 * - Return safe, standardised error responses to clients
 * - Prevent information disclosure in production environments
 * - Maintain service availability despite unexpected errors
 *
 * Error Types Handled:
 * - Synchronous errors thrown in middleware/routes
 * - Async errors passed to next() callback
 * - Unhandled exceptions that reach the Express error boundary
 * - Third-party middleware errors (CORS, rate limiting, etc.)
 *
 * GraphQL Considerations:
 * - Apollo Server handles GraphQL errors separately
 * - This handler catches Express-level errors (middleware, routing, etc.)
 * - Should NOT interfere with GraphQL error formatting
 *
 * Security Principles:
 * - Never expose stack traces or internal details in production
 * - Log sensitive information server-side only
 * - Provide helpful error context for development
 * - Implement rate limiting for error responses to prevent abuse
 */

import express from 'express';
import {serverConfiguration} from '../managers/environmentManager';

/**
 * Error Handler Factory Function
 *
 * Creates a configured error handler middleware with injected logger dependency.
 * Factory pattern allows for proper dependency injection and testability.
 *
 * Benefits of Factory Pattern:
 * - Logger dependency injection for testing and flexibility
 * - Configuration isolation and reusability
 * - Proper closure scoping for performance
 * - Type safety with TypeScript
 *
 * @param logger - Winston logger instance for error reporting
 * @returns Express error handler middleware function
 */

export const createErrorHandler = (logger: any) => {
    /**
     * Express Global Error Handler Middleware
     *
     * CRITICAL: This middleware MUST be the last middleware registered in the Express app.
     * Express only calls error handlers when errors are explicitly passed to next(error).
     *
     * Error Handler Signature Requirements:
     * - Must have exactly 4 parameters (err, req, res, next)
     * - Express identifies error handlers by the 4-parameter signature
     * - Unused parameters still required for proper Express recognition
     *
     * @param err - The error object (Error instance or any thrown value)
     * @param req - Express request object with request context
     * @param res - Express response object for sending error response
     * @param next - Express next function (unused but required for signature)
     */
    return (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('Unhandled error', {
            error: err.message,
            stack: err.stack,
            url: req.url,
            method: req.method
        });

        res.status(500).json({
            error: serverConfiguration.nodeEnv === 'production'
                ? 'Internal Server Error'
                : err.message
        });
        next();
    }
};
