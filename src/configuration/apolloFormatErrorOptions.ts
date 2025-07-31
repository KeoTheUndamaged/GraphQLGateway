/**
 * Apollo Server Error Formatting Configuration
 *
 * This module handles GraphQL error formatting for security and observability.
 * It provides different error exposure levels between development and production environments.
 *
 * Security Principles:
 * - Production: Hide sensitive error details from clients
 * - Development: Expose full error information for debugging
 * - Always log complete error details for monitoring and debugging
 *
 * Error Types Handled:
 * - GraphQL validation errors (malformed queries)
 * - GraphQL execution errors (resolver failures)
 * - Apollo Armour security violations
 * - Subgraph communication errors
 * - Gateway composition errors
 */

import {createLogger} from '../managers/loggerManager';
import {serverConfiguration} from '../managers/environmentManager';

const logger = createLogger(serverConfiguration.logLevel);

/**
 * Custom GraphQL Error Formatter
 *
 * Formats GraphQL errors for client responses while maintaining security.
 * All errors are logged in full for operational monitoring.
 *
 * Development vs Production Behavior:
 * - Development: Returns a complete error object including stack traces
 * - Production: Returns sanitised error with safe information only
 *
 * @param err - The GraphQL error object from Apollo Server
 * @returns Formatted error object safe for client consumption
 */

const formatError = (err: any) => {
    // Log all errors with complete details for monitoring and debugging
    // This ensures no error information is lost for operational purposes

    logger.error('GraphQL Error Occurred', {
        message: err.message,
        code: err.extensions?.code,
        errorType: err.extensions?.errorType,
        path: err.path, // GraphQL field path where the error occurred
        locations: err.locations, // Query line/column numbers
        source: err.source?.body, // Original query (be careful with sensitive data)
        stack: err.stack, // Full stack trace for debugging
        // Additional metadata for production debugging
        service: serverConfiguration.serviceName,
        environment: serverConfiguration.nodeEnv,
    });

    // Development Environment: Return full error details
    // This helps developers debug issues quickly during development
    if (serverConfiguration.nodeEnv !== 'production') return err;

    // Production Environment: Return sanitized error
    // Only expose information that is safe for public consumption
    return {
        // Core error information that's safe to expose
        message: sanitiseErrorMessage(err.message),

        // Extensions contain structured error metadata
        extensions: {
            // Apollo Server standard error codes (safe to expose)
            code: err.extensions?.code,

            // Custom error types for client error handling
            errorType: err.extensions?.errorType,

            // Additional safe metadata
            timestamp: new Date().toISOString(),
        },

        // Include GraphQL path for client debugging (usually safe)
        path: err.path,

        // Query locations help with client-side debugging
        locations: err.locations,

        // Exclude sensitive information in production:
        // - stack traces (reveal server internals)
        // - source code (may contain sensitive data)
        // - internal error details

    }
}

/**
 * Sanitises error messages to prevent information disclosure
 *
 * Some error messages may contain sensitive information like:
 * - Database connection strings
 * - Internal service URLs
 * - File system paths
 * - Environment variables
 *
 * @param message - Original error message
 * @returns Sanitized error message safe for client consumption
 */
const sanitiseErrorMessage = (message: string): string => {
    // Handle common GraphQL errors that are safe to expose
    const safeErrorPatterns = [
        /^Cannot query field/,           // Field doesn't exist
        /^Variable .* is not defined/,   // Undefined variable
        /^Argument .* is required/,      // Missing the required argument
        /^Expected type/,                // Type mismatch
        /^Syntax Error/,                 // Query syntax errors
        /^Must provide query string/,    // Empty query
    ];

    // Check if the error message matches safe patterns
    const isSafeError = safeErrorPatterns.some(pattern => pattern.test(message));

    if (isSafeError) {
        return message; // Safe to expose as-is
    }

    // For other errors, return a generic message to prevent information disclosure
    // The full error is always logged for debugging purposes
    return 'An error occurred while processing your request';
}

export default formatError;
