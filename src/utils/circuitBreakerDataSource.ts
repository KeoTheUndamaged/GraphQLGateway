/**
 * Circuit Breaker Enhanced GraphQL Data Source
 *
 * This class extends Apollo Gateway's RemoteGraphQLDataSource to provide intelligent
 * circuit breaker protection for GraphQL subgraph communications. It prevents cascade
 * failures and provides graceful degradation when subgraph services are unavailable.
 *
 * Key Features:
 * - Intelligent error classification (infrastructure vs business logic)
 * - Circuit breaker pattern implementation for service resilience
 * - Graceful fallback responses during service outages
 * - Comprehensive logging for operational visibility
 * - GraphQL-aware error handling and response structure preservation
 *
 * Circuit Breaker States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are blocked, and fallback is used
 * - HALF_OPEN: Testing if service has recovered, limited requests allowed
 *
 * Error Classification Strategy:
 * - Infrastructure failures (5xx, timeouts, connection errors) → Trip circuit breaker
 * - Business logic errors (404, validation errors) → Pass through normally
 * - Unknown errors → Default to infrastructure failure (fail-safe)
 */

import { RemoteGraphQLDataSource } from '@apollo/gateway';
import { circuitBreakerManager } from '../managers/circuitBreakerManager';
import { createLogger } from '../managers/loggerManager';
import { serverConfiguration } from '../managers/environmentManager';

export class CircuitBreakerDataSource extends RemoteGraphQLDataSource {
    /**
     * Circuit breaker instance for this specific subgraph service
     * Manages failure tracking, state transitions, and recovery logic
     */
    private circuitBreaker;

    /**
     * Logger instance configured with the application's log level
     * Used for operational visibility and debugging circuit breaker behavior
     */
    private logger = createLogger(serverConfiguration.logLevel);

    /**
     * Service name for this subgraph (e.g. 'products', 'users', 'orders')
     * Used for logging, metrics, and error messaging
     */
    private serviceName: string;

    /**
     * Constructor: Initialise Circuit Breaker Enhanced Data Source
     *
     * Creates a circuit breaker instance specifically configured for this subgraph.
     * Each subgraph gets its own circuit breaker to provide independent failure isolation.
     *
     * @param config - Configuration object containing service address and name
     * @param config.url - GraphQL endpoint address for the subgraph service
     * @param config.name - Logical name of the subgraph service
     */
    constructor(config: { url: string; name: string }) {
        // Initialise the parent RemoteGraphQLDataSource with the service configuration
        super(config);

        // Store service name for logging and error reporting
        this.serviceName = config.name;

        /**
         * Circuit Breaker Initialisation
         *
         * Creates a dedicated circuit breaker for this subgraph with custom configuration.
         * The circuit breaker name uses a standardised format for consistent identification.
         *
         * Configuration Strategy:
         * - failureThreshold: 5 consecutive failures trigger circuit opening
         * - recoveryTimeout: 30 seconds before attempting service recovery
         * - halfOpenMaxCalls: 3 test requests during recovery phase
         *
         * These values can be overridden via environment variables for production tuning.
         */
        this.circuitBreaker = circuitBreakerManager.createCircuitBreaker(
            `subgraph-${config.name}`, // Standardised naming convention
            {
                /**
                 * Subgraph-Specific Circuit Breaker Options
                 *
                 * These settings are optimised for GraphQL subgraph communication patterns:
                 * - Lower failure threshold for faster protection
                 * - Shorter recovery timeout for responsive service restoration
                 * - Conservative test request count to minimise the load during recovery
                 */
                failureThreshold: 5,      // Trip after 5 consecutive infrastructure failures
                recoveryTimeout: 30000,   // Wait 30 seconds before testing recovery
                halfOpenMaxCalls: 3       // Allow 3 test requests during the recovery phase
            }
        );
    }

    /**
     * Main Request Processing Method with Circuit Breaker Protection
     *
     * This method wraps the standard GraphQL request processing with intelligent
     * circuit breaker logic. It distinguishes between infrastructure failures
     * (which should trip the circuit breaker) and business logic errors
     * (which should pass through normally).
     *
     * Request Flow:
     * 1. Circuit breaker evaluates current state
     * 2. If CLOSED/HALF_OPEN: Execute primary operation
     * 3. If OPEN: Execute fallback operation immediately
     * 4. Classify any errors as infrastructure vs business logic
     * 5. Update circuit breaker state based on error classification
     *
     * @param request - GraphQL request object containing a query, variables, and context
     * @returns Promise<any> - GraphQL response or fallback response
     */
    async process(request: any): Promise<any> {
        return this.circuitBreaker.execute(
            /**
             * Primary Operation: Intelligent GraphQL Request Processing
             *
             * Attempts to execute the GraphQL request against the subgraph service
             * with sophisticated error handling that preserves business logic errors
             * while protecting against infrastructure failures.
             */
            async () => {
                try {
                    /**
                     * Execute Standard GraphQL Request
                     *
                     * Delegates to the parent RemoteGraphQLDataSource.process() method
                     * which handles authentication, request transformation, and HTTP communication.
                     */
                    const result = await super.process(request);

                    /**
                     * GraphQL Response Structure Validation
                     *
                     * Ensures the response follows GraphQL specification structure.
                     * Valid responses must have 'data' and/or 'errors' fields.
                     *
                     * This check prevents malformed responses from being treated as successful,
                     * which could mask infrastructure issues.
                     */
                    if (this.isValidGraphQLResponse(result)) {
                        return result;
                    }

                    /**
                     * Invalid Response Structure Handling
                     *
                     * If the response doesn't follow the GraphQL structure, it indicates
                     * an infrastructure problem (proxy errors, malformed responses, etc.)
                     * rather than a business logic issue.
                     */
                    throw new Error('Invalid GraphQL response structure');
                } catch (error: any) {
                    /**
                     * Critical Error Classification Logic
                     *
                     * This is the core intelligence of the circuit breaker.
                     * It determines whether an error should trip the circuit breaker
                     * or be passed through as a legitimate business response.
                     *
                     * Classification Categories:
                     * 1. Infrastructure Failures → Trip circuit breaker
                     * 2. Business Logic Errors → Pass through normally
                     * 3. Unknown Errors → Default to infrastructure failure (fail-safe)
                     */
                    if (this.isInfrastructureFailure(error)) {
                        /**
                         * Infrastructure Failure Handling
                         *
                         * Re-throws the error to trigger circuit breaker failure counting.
                         * The circuit breaker will track consecutive failures and potentially
                         * transition to OPEN state if the threshold is exceeded.
                         */
                        throw error;
                    }

                    /**
                     * Business Logic Error Handling
                     *
                     * For business logic errors (404 Not Found, validation errors, etc.),
                     * we extract and return the GraphQL response structure without
                     * triggering circuit breaker failure counting.
                     *
                     * This preserves the original error information for the client
                     * while preventing legitimate business errors from causing
                     * circuit breaker activation.
                     */
                    if (error.extensions?.response) {
                        const response = error.extensions.response;

                        /**
                         * GraphQL Response Extraction
                         *
                         * Extracts the GraphQL response from the error object.
                         * Apollo Gateway wraps HTTP responses in error.extensions.response
                         * when the HTTP request succeeds but contains GraphQL errors.
                         */
                        if (response.body && (response.body.data !== undefined || response.body.errors)) {
                            return response.body;
                        }
                    }

                    /**
                     * Unknown Error Handling (Fail-Safe Strategy)
                     *
                     * If we cannot classify the error definitively, we default to
                     * treating it as an infrastructure failure. This fail-safe approach
                     * prioritises system stability over request success rate.
                     */
                    throw error;
                }
            },
            /**
             * Fallback Operation: Graceful Degradation Response
             *
             * When the circuit breaker is OPEN (service is considered failed),
             * this function provides a graceful degradation response instead
             * of letting requests fail completely.
             *
             * The fallback response follows GraphQL specification and provides
             * clear information about the service unavailability.
             */
            () => this.getFallbackResponse(request)
        );
    }

    /**
     * GraphQL Response Structure Validation
     *
     * Validates that a response object conforms to the GraphQL specification structure.
     * Valid GraphQL responses must contain at least one of:
     * - 'data' field: The requested data (can be null)
     * - 'errors' field: Array of error objects
     *
     * This validation helps distinguish between:
     * - Valid GraphQL responses (including those with business logic errors)
     * - Infrastructure failures that return non-GraphQL responses
     *
     * Examples of valid responses:
     * - { data: { user: { name: "John" } } }
     * - { data: null, errors: [{ message: "User not found" }] }
     * - { errors: [{ message: "Authentication required" }] }
     *
     * Examples of invalid responses:
     * - HTML error pages from proxy servers
     * - Plain text error messages
     * - Empty responses or malformed JSON
     *
     * @param result - Response object to validate
     * @returns boolean - True if response follows GraphQL structure
     */
    private isValidGraphQLResponse(result: any): boolean {
        return result && (
            result.data !== undefined ||
            (result.errors && Array.isArray(result.errors))
        );
    }

    /**
     * Infrastructure vs Business Logic Error Classification
     *
     * This is the critical intelligence that determines whether an error should
     * trigger circuit breaker failure counting or be treated as a normal business response.
     *
     * Classification Strategy:
     * 1. Network/Connection Errors → Infrastructure failure
     * 2. HTTP 5xx Status Codes → Infrastructure failure
     * 3. HTTP 4xx Infrastructure Codes (408, 429, 503, 504) → Infrastructure failure
     * 4. HTTP 4xx Business Logic Codes (400, 401, 403, 404) → Business logic
     * 5. Error Message Pattern Matching → Infrastructure failure
     * 6. Unknown/Unclassifiable Errors → Infrastructure failure (fail-safe)
     *
     * This classification prevents business logic errors like "Product not found"
     * from triggering circuit breaker activation while still protecting against
     * real infrastructure issues.
     *
     * @param error - Error object to classify
     * @returns boolean - True if error represents infrastructure failure
     */
    private isInfrastructureFailure(error: any): boolean {
        /**
         * Network and Connection Error Detection
         *
         * These error codes indicate network-level failures that definitely
         * represent infrastructure problems rather than business logic issues.
         *
         * Common Network Error Codes:
         * - ECONNREFUSED: Connection actively refused (service down)
         * - ENOTFOUND: DNS resolution failed (service unreachable)
         * - ETIMEDOUT: Connection or request timeout (network/service slow)
         * - ECONNRESET: Connection reset by the peer (network/service restart)
         */
        if (error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET') {
            return true;
        }

        /**
         * HTTP Status Code Classification
         *
         * Analyses HTTP status codes to distinguish between infrastructure
         * failures and business logic responses.
         */
        if (error.extensions?.response?.status) {
            const status = error.extensions.response.status;

            /**
             * 5xx Server Error Classification
             *
             * All 5xx status codes indicate server-side infrastructure problems:
             * - 500 Internal Server Error
             * - 502 Bad Gateway
             * - 503 Service Unavailable
             * - 504 Gateway Timeout
             * - etc.
             */
            if (status >= 500) {
                return true;
            }

            /**
             * 4xx Infrastructure vs Business Logic Classification
             *
             * Not all 4xx errors are business logic. Some indicate infrastructure issues:
             *
             * Infrastructure 4xx Codes:
             * - 408 Request Timeout: Infrastructure performance issue
             * - 429 Too Many Requests: Rate limiting/infrastructure protection
             * - 503 Service Unavailable: Service temporarily down
             * - 504 Gateway Timeout: Infrastructure timeout
             *
             * Business Logic 4xx Codes:
             * - 400 Bad Request: Invalid query/variables
             * - 401 Unauthorised: Authentication required
             * - 403 Forbidden: Permission denied
             * - 404 Not Found: Resource doesn't exist
             */
            if (status === 408 || // Request Timeout
                status === 429 || // Too Many Requests (rate limiting)
                status === 503 || // Service Unavailable
                status === 504) { // Gateway Timeout
                return true;
            }

            /**
             * Business Logic 4xx Response Handling
             *
             * Other 4xx status codes (400, 401, 403, 404) represent valid
             * business logic responses that should not trip the circuit breaker.
             * These indicate successful HTTP communication with meaningful
             * application-level responses.
             */
            return false;
        }

        /**
         * Error Message Pattern Analysis
         *
         * When status codes are unavailable, analyse error messages for
         * patterns that indicate infrastructure vs business logic issues.
         *
         * Infrastructure Error Patterns:
         * - "timeout" → Network or service performance issues
         * - "connection" → Network connectivity problems
         * - "network" → Network-level failures
         * - "socket" → Low-level connection issues
         */
        const errorMessage = error.message?.toLowerCase() || '';

        if (errorMessage.includes('timeout') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('network') ||
            errorMessage.includes('socket')) {
            return true;
        }

        /**
         * Fail-Safe Default: Unknown Error Handling
         *
         * For errors that cannot be definitively classified, we default to
         * treating them as infrastructure failures. This fail-safe approach
         * prioritises system stability and prevents unknown error types
         * from causing system-wide issues.
         *
         * This conservative approach may occasionally trigger the circuit breaker
         * for non-infrastructure issues, but it prevents more serious problems
         * like cascade failures when new error types are encountered.
         */
        return true;
    }

    /**
     * Circuit Breaker Fallback Response Generator
     *
     * Generates a graceful degradation response when the circuit breaker is OPEN
     * and the subgraph service is considered unavailable. This response follows
     * the GraphQL specification and provides clear information about service status.
     *
     * Fallback Response Features:
     * - GraphQL-compliant structure (data: null, errors array)
     * - Clear service unavailability message
     * - Diagnostic information for debugging
     * - Retry timing information for clients
     * - Comprehensive logging for operational visibility
     *
     * The response helps clients understand:
     * 1. That the service is temporarily unavailable (not a permanent error)
     * 2. Which specific service is affected
     * 3. When they might retry (retryAfter field)
     * 4. That this is a circuit breaker response (for debugging)
     *
     * @param request - Original GraphQL request (used for logging context)
     * @returns Promise<any> - GraphQL-compliant fallback response
     */
    private async getFallbackResponse(request: any): Promise<any> {
        /**
         * Circuit Breaker State Information Gathering
         *
         * Retrieves current circuit breaker statistics for logging and
         * client information. This helps with debugging and provides
         * context for the fallback response.
         */
        const circuitStats = this.circuitBreaker.getStats();

        /**
         * Comprehensive Fallback Activation Logging
         *
         * Logs detailed information about the circuit breaker activation
         * for operational visibility and debugging. Includes:
         * - Service identification
         * - Query context (truncated for log size management)
         * - Circuit breaker state and failure count
         * - Request variables for debugging
         */
        this.logger.warn(`Circuit breaker fallback activated`, {
            service: this.serviceName,
            query: request.query?.substring(0, 200), // Truncate long queries for log readability
            variables: request.variables,
            circuitState: circuitStats.state,
            failures: circuitStats.failures
        });

        /**
         * GraphQL-Compliant Fallback Response Construction
         *
         * Constructs a response that follows GraphQL specification while
         * providing clear information about the service unavailability.
         * The response structure mirrors what clients expect from GraphQL
         * APIs, making it easier for client applications to handle gracefully.
         */
        return {
            /**
             * Data Field: null (No Data Available)
             *
             * Sets data to null to indicate that the requested data
             * is not available due to service unavailability.
             */
            data: null,

            /**
             * Errors Array: Service Unavailability Error
             *
             * Provides a comprehensive error object that includes:
             * - Clear, user-friendly error message
             * - Structured error extensions for programmatic handling
             * - Diagnostic information for debugging and monitoring
             */
            errors: [{
                /**
                 * User-Friendly Error Message
                 *
                 * Provides a clear, actionable message that explains:
                 * 1. Which service is affected
                 * 2. That the issue is temporary
                 * 3. What action the user should take
                 */
                message: `${this.serviceName} service is temporarily unavailable. Please try again later.`,

                /**
                 * Error Extensions: Structured Diagnostic Information
                 *
                 * Provides structured information for client applications
                 * and monitoring systems to programmatically handle the error.
                 */
                extensions: {
                    /**
                     * Error Code: SERVICE_UNAVAILABLE
                     *
                     * Standard error code that client applications can use
                     * to implement specific handling logic for service outages.
                     */
                    code: 'SERVICE_UNAVAILABLE',

                    /**
                     * Circuit Breaker Flag
                     *
                     * Indicates that this error is specifically due to
                     * circuit breaker activation, helping distinguish from
                     * other service unavailability causes.
                     */
                    circuitBreakerTripped: true,

                    /**
                     * Service Identification
                     *
                     * Identifies which specific subgraph service is unavailable,
                     * useful for debugging and targeted retry logic.
                     */
                    serviceName: this.serviceName,

                    /**
                     * Retry Timing Information
                     *
                     * Calculates when the client should attempt to retry
                     * based on the circuit breaker's recovery timeout.
                     * Helps prevent thundering herd problems during recovery.
                     */
                    retryAfter: Math.ceil(
                        (circuitStats.nextAttemptTime?.getTime() || Date.now()) - Date.now()
                    ) / 1000, // Convert to seconds

                    /**
                     * Timestamp
                     *
                     * ISO timestamp when the fallback response was generated,
                     * useful for debugging and correlation with logs.
                     */
                    timestamp: new Date().toISOString()
                }
            }]
        };
    }
}