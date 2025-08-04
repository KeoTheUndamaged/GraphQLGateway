/**
 * Circuit Breaker Implementation
 *
 * A robust implementation of the Circuit Breaker pattern for resilient service communication.
 * Provides automatic failure detection, service protection, and graceful degradation capabilities.
 *
 * The Circuit Breaker Pattern:
 * The circuit breaker pattern prevents cascading failures in distributed systems by monitoring
 * service calls and "tripping" when failure rates exceed acceptable thresholds. It provides
 * three key benefits:
 * 1. Prevents resource exhaustion from repeatedly calling failing services
 * 2. Provides fast failure responses instead of long timeouts
 * 3. Enables automatic recovery testing when services become available again
 *
 * State Machine Overview:
 * CLOSED → Normal operation, all requests pass through
 * OPEN → Service is failing, requests are blocked and fallback is used
 * HALF_OPEN → Testing recovery, limited requests allowed to test service health
 *
 * Key Features:
 * - Configurable failure thresholds and recovery timeouts
 * - Statistical significance requirements (minimum calls)
 * - Comprehensive monitoring and statistics
 * - Flexible fallback mechanism support
 * - Detailed operational logging
 */

/**
 * Circuit Breaker State Enumeration
 *
 * Defines the three possible states of a circuit breaker following the classic pattern.
 * Each state represents a different operational mode with specific behaviour:
 *
 * CLOSED: Normal operational state
 * - All requests are allowed through to the protected service
 * - Failure counting is active to detect service degradation
 * - Transitions to OPEN when the failure threshold is exceeded
 *
 * OPEN: Failure protection state
 * - All requests are blocked from reaching the protected service
 * - Fallback responses are used immediately without attempting service calls
 * - Transitions to HALF_OPEN after recovery timeout expires
 *
 * HALF_OPEN: Recovery testing state
 * - Limited number of test requests are allowed through
 * - Service health is evaluated based on test request outcomes
 * - Transitions back to CLOSED on success or OPEN on failure
 */
export enum CircuitState {
    CLOSED = 'CLOSED',      // Normal operation - requests pass through
    OPEN = 'OPEN',          // Service failing - requests blocked, fallback used
    HALF_OPEN = 'HALF_OPEN' // Recovery testing - limited requests allowed
}

/**
 * Circuit Breaker Configuration Options
 *
 * Comprehensive configuration interface for customising circuit breaker behaviour.
 * These options allow fine-tuning for different service characteristics and requirements.
 *
 * Configuration Philosophy:
 * - Balance between protection speed and false positive avoidance
 * - Tunable for high-traffic vs low-traffic scenarios
 * - Adaptable to service-specific failure patterns and recovery times
 */
export interface CircuitBreakerOptions {
    /**
     * Failure Threshold: Maximum Consecutive Failures
     *
     * Number of consecutive failures required to trip the circuit breaker from CLOSED to OPEN.
     * Lower values provide faster protection but may cause false positives.
     * Higher values are more tolerant but slower to protect against real issues.
     *
     * Tuning Guidelines:
     * - High-traffic services: 3-7 (faster response to issues)
     * - Low-traffic services: 5-10 (avoid false positives)
     * - Critical dependencies: 3-5 (faster protection)
     * - Non-critical dependencies: 7-15 (more tolerance)
     */
    failureThreshold: number;

    /**
     * Recovery Timeout: Circuit Recovery Wait Time
     *
     * Time in milliseconds to wait in the OPEN state before attempting recovery via HALF_OPEN.
     * Shorter timeouts enable faster recovery but may overwhelm struggling services.
     * Longer timeouts give services more time to recover but delay restoration.
     *
     * Tuning Guidelines:
     * - Fast-recovering services: 10-30 seconds
     * - Database/infrastructure: 30-120 seconds
     * - External APIs: 60-300 seconds
     * - Consider deployment and restart times
     */
    recoveryTimeout: number;

    /**
     * Monitoring Period: Failure Rate Calculation Window
     *
     * Time window in milliseconds for evaluating failure rates and statistics.
     * Provides sliding window behaviour to prevent indefinite failure accumulation.
     * Shorter periods are more responsive but may be less stable.
     *
     * Tuning Guidelines:
     * - High-frequency services: 5-15 seconds
     * - Low-frequency services: 30-60 seconds
     * - Should be shorter than recovery timeout
     * - Consider traffic patterns and request rates
     */
    monitoringPeriod: number;

    /**
     * Half-Open Max Calls: Recovery Test Request Limit
     *
     * Maximum number of test requests allowed during HALF_OPEN recovery phase.
     * Lower values reduce the load on recovering services but provide less confidence.
     * Higher values provide more thorough testing but may overwhelm weak services.
     *
     * Tuning Guidelines:
     * - Critical services: 1-3 (minimal load during recovery)
     * - Robust services: 3-10 (thorough recovery testing)
     * - Consider service capacity and recovery characteristics
     */
    halfOpenMaxCalls: number;

    /**
     * Minimum Calls Required: Statistical Significance Threshold
     *
     * Minimum number of requests before circuit breaker failure detection activates.
     * Prevents circuit breaker activation during the startup or low-traffic periods.
     * Ensures statistical significance before making protection decisions.
     *
     * Tuning Guidelines:
     * - High-traffic services: 20-100 requests
     * - Low-traffic services: 5-20 requests
     * - Consider typical traffic patterns and request volumes
     * - Balance between protection and false positive prevention
     */
    minimumCallsRequired: number;
}

/**
 * Circuit Breaker Statistics Interface
 *
 * Comprehensive statistics and state information for monitoring and debugging.
 * Provides complete visibility into circuit breaker behaviour and performance.
 *
 * Statistics Usage:
 * - Operational dashboards and monitoring
 * - Health check endpoints
 * - Performance analysis and optimization
 * - Incident response and debugging
 * - SLA monitoring and capacity planning
 */
export interface CircuitBreakerStats {
    /**
     * Current Circuit State
     * The current operational state (CLOSED, OPEN, HALF_OPEN)
     */
    state: CircuitState;

    /**
     * Failure Count
     * Current number of consecutive failures (resets on success in CLOSED state)
     */
    failures: number;

    /**
     * Success Count
     * Total number of successful operations since circuit breaker creation
     */
    successes: number;

    /**
     * Total Call Count
     * Total number of operations attempted (successes and failures)
     */
    totalCalls: number;

    /**
     * Last Failure Timestamp
     * When the most recent failure occurred (undefined if no failures)
     */
    lastFailureTime: Date | undefined;

    /**
     * Next Recovery Attempt Time
     * When the circuit breaker will attempt recovery (OPEN → HALF_OPEN transition)
     */
    nextAttemptTime: Date | undefined;
}

/**
 * Circuit Breaker Implementation Class
 *
 * Core implementation of the circuit breaker pattern with full state management,
 * failure detection, recovery logic, and comprehensive monitoring capabilities.
 *
 * Design Principles:
 * - Thread-safe operation (though JavaScript is single-threaded)
 * - Fail-fast behaviour to prevent resource exhaustion
 * - Automatic recovery with configurable testing
 * - Comprehensive logging for operational visibility
 * - Flexible fallback integration
 */
export class CircuitBreaker {
    /**
     * Current Circuit State
     * Tracks the current operational state of the circuit breaker
     * Controls request routing and failure detection behaviour
     */
    private state: CircuitState = CircuitState.CLOSED;

    /**
     * Consecutive Failure Counter
     * Tracks consecutive failures in the CLOSED state for threshold comparison
     * Resets to 0 on success or state transitions
     */
    private failures: number = 0;

    /**
     * Total Success Counter
     * Tracks lifetime successful operations for statistics and monitoring
     * Continuously incremented, never reset
     */
    private successes: number = 0;

    /**
     * Total Operation Counter
     * Tracks lifetime total operations (successes and failures) for statistics
     * Used for a minimum calls threshold and monitoring
     */
    private totalCalls: number = 0;

    /**
     * Last Failure Timestamp
     * Records when the most recent failure occurred
     * Used for monitoring, alerting, and debugging
     */
    private lastFailureTime?: Date | undefined;

    /**
     * Recovery Attempt Timestamp
     * Calculates when the next recovery attempt should occur (OPEN → HALF_OPEN)
     * Based on current time + recovery timeout when circuit trips
     */
    private nextAttemptTime?: Date | undefined;

    /**
     * Half-Open Request Counter
     * Tracks number of test requests made during HALF_OPEN recovery phase
     * Compared against halfOpenMaxCalls configuration limit
     */
    private halfOpenCalls: number = 0;

    /**
     * Circuit Breaker Constructor
     *
     * Initialises a new circuit breaker instance with the specified configuration.
     * Sets up logging, configuration, and initial state.
     *
     * @param name - Unique identifier for this circuit breaker (used in logs and monitoring)
     * @param options - Configuration options controlling circuit breaker behavior
     * @param logger - Logger instance for operational visibility and debugging
     */
    constructor(
        private name: string,
        private options: CircuitBreakerOptions,
        private logger: any
    ) {}

    /**
     * Main Execution Method
     *
     * Executes the provided operation with circuit breaker protection.
     * Implements the core circuit breaker logic including state management,
     * failure detection, recovery testing, and fallback handling.
     *
     * Execution Flow:
     * 1. Check the current circuit state and determine if operation should proceed
     * 2. Handle OPEN state (use fallback or attempt recovery)
     * 3. Handle HALF_OPEN state limits (enforce test request limits)
     * 4. Execute operation and handle success/failure outcomes
     * 5. Update circuit state based on operation results
     * 6. Provide fallback responses when appropriate
     *
     * @param operation - Primary operation to execute with protection
     * @param fallback - Optional fallback operation for when circuit is open
     * @returns Promise<T> - Result from operation or fallback
     * @throws Error - When circuit is open and no fallback is provided
     */
    async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
        /**
         * OPEN State Handling
         *
         * When a circuit is OPEN, all requests are blocked to protect the failing service.
         * Two possible actions:
         * 1. If the recovery timeout has expired, attempt recovery by moving to HALF_OPEN
         * 2. If the recovery timeout hasn't expired, use fallback or throw error
         */
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                /**
                 * Recovery Attempt: OPEN → HALF_OPEN Transition
                 *
                 * Recovery timeout has expired, so we attempt to test service recovery.
                 * Transition to the HALF_OPEN state and reset the test request counter.
                 */
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenCalls = 0;
                this.logger.info(`Circuit breaker ${this.name} moved to HALF_OPEN state`);
            } else {
                /**
                 * Circuit Remains OPEN: Use Fallback
                 *
                 * Recovery timeout hasn't expired yet, so the circuit remains OPEN.
                 * Use a fallback response or throw an error if no fallback is provided.
                 */
                this.logger.warn(`Circuit breaker ${this.name} is OPEN, using fallback`);
                if (fallback) {
                    return await fallback();
                }
                throw new Error(`Circuit breaker ${this.name} is OPEN and no fallback provided`);
            }
        }

        /**
         * HALF_OPEN State Request Limit Enforcement
         *
         * During recovery testing, we limit the number of test requests to prevent
         * overwhelming a potentially still-struggling service. Once the limit is reached,
         * additional requests use fallback responses.
         */
        if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
            this.logger.warn(`Circuit breaker ${this.name} half-open limit reached, using fallback`);
            if (fallback) {
                return await fallback();
            }
            throw new Error(`Circuit breaker ${this.name} half-open limit reached`);
        }

        /**
         * Operation Execution with Protection
         *
         * Execute the primary operation with comprehensive error handling
         * and state management based on the outcome.
         */
        try {
            /**
             * Pre-Execution Tracking
             *
             * Update counters before attempting the operation.
             * Track total calls for statistics and HALF_OPEN test request counting.
             */
            this.totalCalls++;
            if (this.state === CircuitState.HALF_OPEN) {
                this.halfOpenCalls++;
            }

            /**
             * Primary Operation Execution
             *
             * Execute the protected operation and capture the result.
             * Any thrown exceptions will be caught and handled below.
             */
            const result = await operation();

            /**
             * Success Handling
             *
             * Operation succeeded, so update circuit breaker state accordingly.
             * This may trigger state transitions or reset failure counters.
             */
            this.onSuccess();
            return result;

        } catch (error) {
            /**
             * Failure Handling
             *
             * Operation failed, so update circuit breaker state and determine
             * whether to use fallback or re-throw the error.
             */
            this.onFailure();
            this.logger.error(`Circuit breaker ${this.name} operation failed:`, error);

            /**
             * Fallback Response or Error Propagation
             *
             * If fallback is provided, use it to provide graceful degradation.
             * Otherwise, re-throw the original error to maintain transparency.
             */
            if (fallback) {
                this.logger.info(`Circuit breaker ${this.name} using fallback`);
                return await fallback();
            }
            throw error;
        }
    }

    /**
     * Success Event Handler
     *
     * Processes successful operation outcomes and updates circuit breaker state accordingly.
     * Handles different logic based on the current state for optimal behaviour.
     *
     * Success Handling by State:
     * - CLOSED: Reset failure counter (prevent gradual threshold approach)
     * - HALF_OPEN: Count successful test requests, transition to CLOSED when criteria met
     * - OPEN: Not applicable (requests don't reach this handler in OPEN state)
     */
    private onSuccess(): void {
        /**
         * Success Counter Update
         *
         * Increment total success counters for statistics and monitoring.
         * This counter never resets and provides lifetime success metrics.
         */
        this.successes++;

        /**
         * HALF_OPEN State Success Handling
         *
         * During recovery testing, successful requests indicate the service may be healthy.
         * Once we've completed enough successful test requests, reset to the CLOSED state.
         */
        if (this.state === CircuitState.HALF_OPEN) {
            if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
                /**
                 * Recovery Successful: HALF_OPEN → CLOSED Transition
                 *
                 * All test requests succeeded, so the service appears to have recovered.
                 * Reset circuit breaker to normal operational state.
                 */
                this.reset();
                this.logger.info(`Circuit breaker ${this.name} reset to CLOSED state after successful recovery`);
            }
        } else if (this.state === CircuitState.CLOSED) {
            /**
             * CLOSED State Success Handling
             *
             * Reset failure counter on success to prevent a gradual threshold approach.
             * This ensures only consecutive failures trigger circuit opening.
             */
            this.failures = 0; // Reset failure count on success
        }
    }

    /**
     * Failure Event Handler
     *
     * Processes failed operation outcomes and updates circuit breaker state accordingly.
     * Implements failure counting, threshold detection, and state transitions.
     *
     * Failure Handling by State:
     * - CLOSED: Count failures, trip to OPEN if the threshold exceeded
     * - HALF_OPEN: Any failure during recovery testing immediately trips to OPEN
     * - OPEN: Not applicable (requests don't reach this handler in OPEN state)
     */
    private onFailure(): void {
        /**
         * Failure Tracking
         *
         * Increment failure counter and record failure timestamp.
         * Used for threshold detection and monitoring/alerting.
         */
        this.failures++;
        this.lastFailureTime = new Date();

        /**
         * State-Specific Failure Handling
         */
        if (this.state === CircuitState.HALF_OPEN) {
            /**
             * HALF_OPEN Failure: Immediate Circuit Trip
             *
             * Any failure during recovery testing indicates the service hasn't recovered.
             * Immediately return to OPEN state to continue protection.
             */
            this.trip();
        } else if (this.state === CircuitState.CLOSED && this.shouldTrip()) {
            /**
             * CLOSED State Threshold Check
             *
             * Check if the failure threshold has been exceeded and the minimum calls requirement met.
             * If both conditions are satisfied, trip circuit to OPEN state.
             */
            this.trip();
        }
    }

    /**
     * Circuit Trip Condition Evaluator
     *
     * Determines whether the circuit breaker should trip from CLOSED to OPEN state.
     * Implements both failure threshold and minimum calls requirements for robust operation.
     *
     * Trip Conditions (all must be true):
     * 1. Total calls >= minimum calls required (statistical significance)
     * 2. Consecutive failures >= failure threshold (service degradation detected)
     *
     * This dual-condition approach prevents false positives during:
     * - Service startup periods (low call volume)
     * - Intermittent single failures (not consecutive failure patterns)
     * - Low-traffic periods (insufficient statistical data)
     *
     * @returns boolean - True if circuit should trip to OPEN state
     */
    private shouldTrip(): boolean {
        return this.totalCalls >= this.options.minimumCallsRequired &&
            this.failures >= this.options.failureThreshold;
    }

    /**
     * Circuit Trip Handler
     *
     * Transitions circuit breaker from current state to OPEN state.
     * Sets up the recovery timeout and logs the state change for monitoring.
     *
     * Trip Actions:
     * 1. Change state to OPEN (blocks all future requests)
     * 2. Calculate the next recovery attempt time (current time and recovery timeout)
     * 3. Log state transition for operational visibility
     *
     * After tripping, all requests will be blocked until the recovery timeout expires.
     */
    private trip(): void {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = new Date(Date.now() + this.options.recoveryTimeout);
        this.logger.warn(`Circuit breaker ${this.name} tripped to OPEN state`);
    }

    /**
     * Recovery Attempt Condition Evaluator
     *
     * Determines whether the circuit breaker should attempt recovery by transitioning
     * from OPEN to HALF_OPEN state. Based on recovery timeout expiration.
     *
     * Recovery Conditions:
     * - Recovery timeout must have been set (circuit must have been tripped)
     * - Current time must be >= recovery timeout expiration time
     *
     * @returns boolean - True if recovery should be attempted
     */
    private shouldAttemptReset(): boolean {
        return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
    }

    /**
     * Circuit Reset Handler
     *
     * Resets circuit breaker to the initially CLOSED state with cleared statistics.
     * Called after successful recovery testing in HALF_OPEN state.
     *
     * Reset Actions:
     * 1. Return state to CLOSED (normal operation)
     * 2. Clear all failure and recovery timing data
     * 3. Reset test request counters
     * 4. Maintain total call and success counters for lifetime statistics
     *
     * Note: Total calls and successes are preserved for monitoring and statistics.
     */
    private reset(): void {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.halfOpenCalls = 0;
        this.lastFailureTime = undefined;
        this.nextAttemptTime = undefined;
    }

    /**
     * Statistics and Monitoring Data Provider
     *
     * Returns comprehensive statistics about circuit breaker state and performance.
     * Used for monitoring dashboards, health checks, alerting, and debugging.
     *
     * Statistics Include:
     * - Current operational state
     * - Success and failure counts
     * - Timing information for failures and recovery
     * - Performance metrics for analysis
     *
     * This data enables:
     * - Real-time monitoring dashboards
     * - Automated alerting and notification
     * - Performance analysis and optimisation
     * - Incident response and debugging
     * - Capacity planning and SLA monitoring
     *
     * @returns CircuitBreakerStats - Complete statistics snapshot
     */
    getStats(): CircuitBreakerStats {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            totalCalls: this.totalCalls,
            lastFailureTime: this.lastFailureTime,
            nextAttemptTime: this.nextAttemptTime
        };
    }
}