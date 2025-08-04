/**
 * Apollo Server GraphQL Error Formatting
 *
 * This module defines a custom `formatError` function for Apollo Server, a critical
 * part for managing how errors are presented to clients in a secure and
 * consistent manner. It ensures full error visibility for operational monitoring
 * while preventing sensitive information from being exposed to end users.
 *
 * Core Principles:
 * - Error Sanitisation: Hides technical details in production environments.
 * - Observability: Logs all complete error details for internal debugging and monitoring.
 * - Environment Awareness: Provides different behaviour for development vs. production.
 * - Subgraph Error Handling: Unwraps nested errors from Apollo Gateway responses.
 */

import { createLogger } from '../managers/loggerManager';
import { serverConfiguration } from '../managers/environmentManager';
import { GraphQLFormattedError } from 'graphql';

const logger = createLogger(serverConfiguration.logLevel);

/**
 * GraphQL Error Formatter
 *
 * This is the main entry point for Apollo Server's error handling pipeline.
 * Its primary responsibility is to log all errors for observability and then
 * route them to the correct formatting logic based on the current environment.
 *
 * How it works:
 * - It receives a `formattedError` (standardised for client consumption)
 * and the raw `error` object (containing full stack traces and details).
 * - All details from the raw error are logged immediately for operational
 * monitoring before any sanitisation occurs.
 * - In development, the full error is returned to facilitate debugging.
 * - In production, the error is passed to a dedicated sanitisation function.
 *
 * @param formattedError - The standard GraphQL error object.
 * @param error - The raw, underlying exception (for detailed logging).
 * @returns Formatted error object safe for client consumption.
 */
const formatError = (formattedError: GraphQLFormattedError, error: unknown): GraphQLFormattedError => {
    // Log all errors with complete details for monitoring and debugging
    logger.error('GraphQL Error Occurred', {
        message: formattedError.message,
        code: formattedError.extensions?.code,
        path: formattedError.path,
        locations: formattedError.locations,
        rawError: error,
    });

    // Development Environment: Return full error details
    if (serverConfiguration.nodeEnv !== 'production') {
        return formattedError;
    }

    // Production Environment: Route to sanitisation function
    return formatErrorForProduction(formattedError);
};

/**
 * Allowlisted Error Codes
 *
 * This array contains a list of error codes that are considered safe to
 * expose to clients in a production environment. These codes typically
 * represent predictable and expected outcomes, such as a requested resource
 * not being found or an invalid user input.
 */
const safeErrorCodes = [
    'NOT_FOUND',
    'BAD_USER_INPUT',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'GRAPHQL_VALIDATION_FAILED',
];

/**
 * Secure Production Error Formatting
 *
 * This function implements the strict error handling policy for production.
 * It intelligently determines whether an error is safe to expose to a client
 * or if it should be replaced with a generic, non-descriptive message.
 *
 * Error Handling Logic:
 * 1. Nested Error Check: It first attempts to extract the original, specific
 * error from a nested `extensions.response.body` object, a common pattern
 * for errors originating from a federated subgraph.
 * 2. Safe Code Allowlist: It checks if the identified error code (from either
 * the nested or top-level error) is present in the `safeErrorCodes` list.
 * 3. Sanitisation: If the error code is allowlisted, the original message and
 * code are returned. Otherwise, a generic `INTERNAL_SERVER_ERROR` is returned.
 *
 * @param err - The standard GraphQL error object.
 * @returns A formatted error object that is safe for production.
 */
const formatErrorForProduction = (err: GraphQLFormattedError): GraphQLFormattedError => {
    // Handle introspection disabled errors specifically
    if (err.extensions?.code === 'GRAPHQL_VALIDATION_FAILED' &&
        err.message.includes('introspection is not allowed')) {
        return {
            message: 'GraphQL introspection is disabled',
            extensions: {
                code: 'INTROSPECTION_DISABLED',
                timestamp: new Date().toISOString(),
            },
        };
    }
    // Attempt to extract a nested error from a Gateway response first
    try {
        const subgraphResponse = (err.extensions as any)?.response?.body;
        if (subgraphResponse?.errors && Array.isArray(subgraphResponse.errors) && subgraphResponse.errors.length > 0) {
            const originalError = subgraphResponse.errors[0];
            const originalErrorCode = originalError.extensions?.code;

            if (originalErrorCode && safeErrorCodes.includes(String(originalErrorCode))) {
                return {
                    ...originalError,
                    extensions: {
                        ...originalError.extensions,
                        timestamp: new Date().toISOString(),
                    },
                };
            }
        }
    } catch (e) {
        logger.error('Failed to parse nested subgraph error', { error: e });
    }

    // Fallback to checking the top-level error code if no nested error was found
    const topLevelCode = err.extensions?.code;
    if (topLevelCode && safeErrorCodes.includes(String(topLevelCode))) {
        return {
            ...err,
            extensions: {
                code: topLevelCode,
                timestamp: new Date().toISOString(),
            },
        };
    }

    // Default: Return a generic error for any unhandled or unsafe errors
    return {
        message: 'An internal server error occurred',
        extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
        },
    };
};

export default formatError;