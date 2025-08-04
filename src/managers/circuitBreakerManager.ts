/**
 * Circuit Breaker Manager
 *
 * Central management service for all circuit breakers in the application.
 * Provides a unified interface for creating, configuring, and monitoring
 * circuit breakers across different services and dependencies.
 *
 * Key Responsibilities:
 * - Circuit breaker lifecycle management (creation, configuration, cleanup)
 * - Centralized configuration management with environment variable integration
 * - Service health monitoring and reporting across all circuit breakers
 * - Operational visibility through comprehensive statistics and health checks
 * - Consistent naming conventions and configuration defaults
 *
 * Design Benefits:
 * - Single source of truth for circuit breaker configuration
 * - Consistent behaviour across all services
 * - Simplified monitoring and observability
 * - Easy configuration management through environment variables
 * - Centralized health status for load balancer integration
 *
 * Usage Patterns:
 * - GraphQL subgraph protection (via CircuitBreakerDataSource)
 * - External API dependency protection
 * - Database connection pool protection
 * - Third-party service integration protection
 */

import { CircuitBreaker, CircuitBreakerOptions } from '../utils/circuitBreaker';
import {createLogger, Logger} from './loggerManager';
import {serverConfiguration, circuitBreakerConfiguration} from './environmentManager';

export class CircuitBreakerManager {
    /**
     * Circuit Breaker Registry
     *
     * Maintains a registry of all active circuit breakers indexed by name.
     * Enables centralised management, monitoring, and clean-up of circuit breakers.
     *
     * Key Features:
     * - Fast O(1) lookup by circuit breaker name
     * - Prevents duplicate circuit breaker creation
     * - Enables bulk operations (health checks, statistics collection)
     * - Supports dynamic circuit breaker lifecycle management
     *
     * Naming Convention:
     * - Subgraphs: "subgraph-{serviceName}" (e.g., "subgraph-products")
     * - External APIs: "api-{serviceName}" (e.g., "api-payment-gateway")
     * - Databases: "db-{instanceName}" (e.g., "db-user-store")
     */
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();

    /**
     * Logger Instance
     *
     * Configured logger for operational visibility and debugging.
     * Uses the application's global log level configuration for consistency.
     * Logs circuit breaker lifecycle events, configuration changes, and health status.
     */
    private readonly logger: Logger = createLogger(serverConfiguration.logLevel);

    /**
     * Default Circuit Breaker Configuration
     *
     * Centralised default configuration derived from environment variables.
     * Provides consistent behaviour across all circuit breakers while allowing
     * per-service customisation when needed.
     *
     * Configuration Sources:
     * - Environment variables (production tuning)
     * - Application configuration (development defaults)
     * - Per-service overrides (specific requirements)
     *
     * Configuration Philosophy:
     * - Conservative defaults that prioritise system stability
     * - Tunable via environment variables for different deployment environments
     * - Balanced between protection speed and false positive avoidance
     */
    private defaultOptions: CircuitBreakerOptions = {
        /**
         * Failure Threshold: Maximum Consecutive Failures
         *
         * Number of consecutive failures required to trip the circuit breaker.
         * Derived from the CIRCUIT_BREAKER_FAILURE_THRESHOLD environment variable.
         *
         * Default: 5 failures (balanced sensitivity)
         */
        failureThreshold: circuitBreakerConfiguration.failureThreshold,

        /**
         * Recovery Timeout: Circuit Recovery Wait Time
         *
         * Time in milliseconds to wait before attempting recovery from the OPEN state.
         * Derived from CIRCUIT_BREAKER_RECOVERY_TIMEOUT environment variable.
         *
         * Default: 60,000 ms (1 minute - conservative recovery)
         */
        recoveryTimeout: circuitBreakerConfiguration.recoveryTimeout,

        /**
         * Monitoring Period: Failure Rate Calculation Window
         *
         * Time window for evaluating failure rates and resetting counters.
         * Derived from the CIRCUIT_BREAKER_MONITORING_PERIOD environment variable.
         *
         * Default: 10,000 ms (10 seconds - responsive monitoring)
         */
        monitoringPeriod: circuitBreakerConfiguration.monitoringPeriod,

        /**
         * Half-Open Max Calls: Recovery Test Request Limit
         *
         * Maximum test requests are allowed during the HALF_OPEN recovery phase.
         * Derived from the CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS environment variable.
         *
         * Default: 3 requests (conservative testing)
         */
        halfOpenMaxCalls: circuitBreakerConfiguration.halfOpenMaxCalls,

        /**
         * Minimum Calls Required: Statistical Significance Threshold
         *
         * Minimum requests before circuit breaker can activate (prevents false positives).
         * Derived from the CIRCUIT_BREAKER_MINIMUM_CALLS environment variable.
         *
         * Default: 10 requests (balanced threshold)
         */
        minimumCallsRequired: circuitBreakerConfiguration.minimumCalls
    };

    /**
     * Circuit Breaker Factory Method
     *
     * Creates and registers a new circuit breaker with the specified configuration.
     * Combines default configuration with service-specific overrides to provide
     * flexible configuration while maintaining consistency.
     *
     * Configuration Merging Strategy:
     * 1. Start with the manager's default configuration
     * 2. Apply service-specific overrides (if provided)
     * 3. Create a circuit breaker with merged configuration
     * 4. Register in the manager's registry for monitoring
     * 5. Log configuration for operational visibility
     *
     * Registry Management:
     * - Prevents duplicate circuit breaker names
     * - Enables centralised monitoring and health checks
     * - Supports operational visibility and debugging
     *
     * @param name - Unique identifier for the circuit breaker (e.g. "subgraph-products")
     * @param options - Optional service-specific configuration overrides
     * @returns CircuitBreaker - Configured and registered circuit breaker instance
     */
    createCircuitBreaker(
        name: string,
        options?: Partial<CircuitBreakerOptions>
    ): CircuitBreaker {
        /**
         * Configuration Merging
         *
         * Combines manager defaults with service-specific overrides.
         * Service-specific options take precedence over defaults.
         * Ensures consistent behaviour while allowing customisation.
         */
        const finalOptions = { ...this.defaultOptions, ...options };

        /**
         * Circuit Breaker Instantiation
         *
         * Creates a new circuit breaker with merged configuration.
         * Passes logger instance for consistent logging behaviour.
         * Each circuit breaker maintains its own state and statistics.
         */
        const circuitBreaker = new CircuitBreaker(name, finalOptions, this.logger);

        /**
         * Registry Registration
         *
         * Adds the circuit breaker to the manager's registry.
         * Enables centralised monitoring, health checks, and statistics collection.
         * Overwrites any existing circuit breaker with the same name.
         */
        this.circuitBreakers.set(name, circuitBreaker);

        /**
         * Creation Logging
         *
         * Logs circuit breaker creation with final configuration.
         * Provides operational visibility for debugging and auditing.
         * Includes all configuration parameters for troubleshooting.
         */
        this.logger.info(`Created circuit breaker for ${name}`, finalOptions);

        return circuitBreaker;
    }

    /**
     * Circuit Breaker Lookup Method
     *
     * Retrieves a specific circuit breaker by name from the registry.
     * Used by services to access their circuit breakers for manual operations
     * or advanced configuration scenarios.
     *
     * Use Cases:
     * - Manual circuit breaker control (force open/close)
     * - Direct statistics access for custom monitoring
     * - Advanced configuration updates at runtime
     * - Custom fallback logic implementation
     *
     * @param name - Circuit breaker identifier to lookup
     * @returns CircuitBreaker | undefined - Circuit breaker instance or undefined if not found
     */
    getCircuitBreaker(name: string): CircuitBreaker | undefined {
        return this.circuitBreakers.get(name);
    }

    /**
     * Comprehensive Statistics Collection
     *
     * Aggregates statistics from all registered circuit breakers.
     * Provides a complete view of system resilience status for monitoring
     * and operational dashboards.
     *
     * Statistics Include:
     * - Current state (CLOSED, OPEN, HALF_OPEN)
     * - Failure counts and success rates
     * - Recovery timing information
     * - Request volume and patterns
     * - Performance metrics
     *
     * Use Cases:
     * - Operational dashboards and monitoring
     * - Health check endpoints for load balancers
     * - Performance analysis and capacity planning
     * - Incident response and debugging
     * - SLA monitoring and reporting
     *
     * @returns Record<string, any> - Dictionary of circuit breaker names to their statistics
     */
    getAllStats() {
        const stats: Record<string, any> = {};

        /**
         * Statistics Aggregation Loop
         *
         * Iterates through all registered circuit breakers and collects
         * their current statistics. Each circuit breaker provides its own
         * comprehensive state information.
         */
        for (const [name, breaker] of this.circuitBreakers) {
            stats[name] = breaker.getStats();
        }

        return stats;
    }

    /**
     * System Health Status Assessment
     *
     * Provides a high-level health assessment of the entire system's
     * circuit breaker status. Designed for integration with load balancers,
     * health check endpoints, and monitoring systems.
     *
     * Health Assessment Logic:
     * - System is "healthy" if no circuit breakers are OPEN
     * - System is "unhealthy" if any circuit breakers are OPEN
     * - Provides a detailed breakdown for debugging and analysis
     *
     * Health Status Information:
     * - Overall health boolean (healthy/unhealthy)
     * - List of OPEN circuit breakers (failing services)
     * - Total circuit breaker count (system coverage)
     * - Complete statistics for detailed analysis
     *
     * Integration Points:
     * - Load balancer health checks
     * - Kubernetes readiness/liveness probes
     * - Monitoring system alerts
     * - Service mesh health reporting
     * - API gateway health endpoints
     *
     * @returns Object - Comprehensive health status with detailed breakdown
     */
    getHealthStatus() {
        /**
         * Statistics Collection for Health Assessment
         *
         * Retrieves current statistics from all circuit breakers
         * to analyse their states and determine overall system health.
         */
        const stats = this.getAllStats();

        /**
         * OPEN Circuit Breaker Identification
         *
         * Filters circuit breaker statistics to identify which services
         * are currently in OPEN state (failing and using fallback responses).
         * These represent services that are currently unavailable.
         */
        const openCircuits = Object.entries(stats)
            .filter(([_, stat]) => stat.state === 'OPEN')
            .map(([name, _]) => name);

        /**
         * Health Status Response Construction
         *
         * Builds comprehensive health status response with:
         * - Boolean health indicator for quick assessment
         * - List of failing services for targeted response
         * - System coverage metrics for capacity planning
         * - Detailed statistics for deep analysis
         */
        return {
            /**
             * Overall Health Indicator
             *
             * Simple boolean indicating whether the system is healthy.
             * True if no circuit breakers are OPEN, false otherwise.
             * Used by load balancers and automated systems for quick decisions.
             */
            healthy: openCircuits.length === 0,

            /**
             * Failing Services List
             *
             * Array of circuit breaker names that are currently OPEN.
             * Enables targeted incident response and service restoration efforts.
             * Empty array indicates all services are operational.
             */
            openCircuits,

            /**
             * System Coverage Metrics
             *
             * Total number of registered circuit breakers.
             * Indicates how many services/dependencies are protected.
             * Useful for capacity planning and coverage analysis.
             */
            totalCircuits: this.circuitBreakers.size,

            /**
             * Detailed Statistics
             *
             * Complete statistics from all circuit breakers.
             * Enables deep analysis, debugging, and performance optimisation.
             * Includes timing information, failure patterns, and recovery metrics.
             */
            stats
        };
    }
}

/**
 * Global Circuit Breaker Manager Instance
 *
 * Singleton instance of the CircuitBreakerManager for application-wide use.
 * Provides centralised access to circuit breaker management functionality
 * across all application modules and services.
 *
 * Usage Patterns:
 * - Import and use directly in service classes
 * - Access from GraphQL data sources for subgraph protection
 * - Use in middleware for external API protection
 * - Integration with health check endpoints
 *
 * Singleton Benefits:
 * - Consistent configuration across the application
 * - Centralised monitoring and management
 * - Simplified dependency injection
 * - Single source of truth for circuit breaker state
 *
 * Example Usage:
 *
 * import { circuitBreakerManager } from './managers/circuitBreakerManager';
 *
 * // Create a circuit breaker for a service
 * const breaker = circuitBreakerManager.createCircuitBreaker('api-payment', {
 *   failureThreshold: 3,
 *   recoveryTimeout: 30000
 * });
 *
 * // Check overall system health
 * const health = circuitBreakerManager.getHealthStatus();
 *
 */
export const circuitBreakerManager = new CircuitBreakerManager();