/**
 * Health Check Handler for GraphQL Gateway
 *
 * Provides comprehensive service health information for monitoring, orchestration,
 * and operational visibility. Critical for production deployments and DevOps workflows.
 *
 * Use Cases:
 * - Load balancer health checks (determine if instance should receive traffic)
 * - Container orchestration readiness/liveness probes (Kubernetes, Docker Swarm)
 * - Monitoring system status checks (Prometheus, DataDog, New Relic)
 * - CI/CD pipeline deployment verification
 * - Incident response and troubleshooting
 *
 * Health Check Types:
 * - Shallow: Basic process health (this implementation)
 * - Deep: Includes dependency health (database, external APIs, etc.)
 * - Business: Application-specific health metrics
 *
 * Security Considerations:
 * - Information disclosure in production vs development
 * - Rate limiting to prevent abuse
 * - Authentication for sensitive health data
 */

import {Request, Response} from 'express';
import {serverConfiguration} from '../managers/environmentManager';
import {circuitBreakerManager} from '../managers/circuitBreakerManager';

/**
 * Health Check Response Interface
 *
 * Standardised health check response format following industry best practices.
 * Compatible with common monitoring tools and orchestration platforms.
 */
interface Healthcheck {
    /** Overall service status - used by load balancers for routing decisions */
    status: 'OK' | 'WARNING' | 'CRITICAL' | 'DEGRADED' | 'UNKNOWN';
    /** Human-readable status description */
    message: string;
    /** ISO timestamp for health check execution time */
    timestamp: string;
    /** Process uptime in seconds - useful for detecting recent restarts */
    uptime: number;
    /** Deployment environment identifier */
    environment: string;
    /** Service identification information */
    service: {
        name: string;
        version: string;
    }
    circuitBreakers: {
        healthy: boolean;
        openCircuits: string[];
        totalCircuits: number,
        details: Record<string, any>
    }
    /** Memory usage metrics (development only for security) */
    memory?: NodeJS.MemoryUsage;
}

/**
 * Primary Health Check Handler
 *
 * Performs rapid health assessment and returns standardised status information.
 * Optimised for high-frequency calls from load balancers and monitoring systems.
 *
 * Response Time Target: < 50 ms (critical for load balancer timeouts)
 *
 * @param _req - Express request object (unused but available for advanced checks)
 * @param res - Express response object for health status response
 */
const healthcheck = (_req: Request, res: Response) => {

    const circruitBreakerHealth = circuitBreakerManager.getHealthStatus();

    const body: Healthcheck = {
        /**
         * Service Status Assessment
         *
         * Current implementation: Basic process health-only
         * Status is always 'OK' if the process is running and can respond
         *
         * Future enhancements could include:
         * - Apollo Server status checks
         * - GraphQL Gateway connectivity
         * - Subgraph availability
         * - Resource utilisation thresholds
         */
        status: circruitBreakerHealth.healthy ? 'OK' : 'DEGRADED',
        /**
         * Status Message
         *
         * Provides human-readable context for the health status.
         * Should be concise but informative for operations teams.
         */
        message: 'Service is running',
        /**
         * Timestamp
         *
         * An ISO 8601 formatted timestamp for health check execution.
         * Critical for:
         * - Debugging stale health check responses
         * - Monitoring health check frequency
         * - Correlating health status with other logs/metrics
         */
        timestamp: new Date().toISOString(),
        /**
         * Process Uptime
         *
         * Time in seconds since the Node.js process started.
         *
         * Operational Value:
         * - Detect recent restarts (low uptime = recent deployment/crash)
         * - Monitor service stability (frequent restarts indicate issues)
         * - Correlate performance issues with service age
         */
        uptime: process.uptime(),
        /**
         * Environment Identifier
         *
         * Critical for multienvironment deployments to prevent confusion.
         * Helps operations teams verify they're checking the correct environment.
         */
        environment: serverConfiguration.nodeEnv,
        /**
         * Service Identification
         *
         * Unique service identification for distributed system visibility.
         * Essential for:
         * - Service discovery and registration
         * - Version tracking across deployments
         * - Incident response and debugging
         */
        service: {
            name: serverConfiguration.serviceName,
            version: serverConfiguration.serviceVersion,
        },
        circuitBreakers: {
            healthy: circruitBreakerHealth.healthy,
            openCircuits: circruitBreakerHealth.openCircuits,
            totalCircuits: circruitBreakerHealth.totalCircuits,
            details: circruitBreakerHealth.stats
        }
    }
    /**
     * Development-Only Memory Metrics
     *
     * Memory usage information is included only in non-production environments
     * to prevent information disclosure while providing development insights.
     *
     * Security Rationale:
     * - Memory patterns can reveal application behaviour to attackers
     * - Production systems should use dedicated monitoring tools
     * - Development teams need this data for optimisation
     */
    if (serverConfiguration.nodeEnv !== 'production') {
        body.memory = process.memoryUsage();
    }

    res.status(200).json(body)
}

export default healthcheck;

/**
 * PRODUCTION DEPLOYMENT CHECKLIST:
 *
 * 1. Configure load balancer health check endpoint (/healthcheck)
 * 2. Set appropriate health check intervals (10-30 seconds recommended)
 * 3. Configure health check timeouts (< 5 seconds)
 * 4. Implement dependency health checks for deep monitoring
 * 5. Set up monitoring alerts for health check failures
 * 6. Test health check behaviour during service degradation
 * 7. Document health check response format for operations teams
 *
 * KUBERNETES INTEGRATION:
 *
 * Readiness Probe (traffic routing):
 * readinessProbe:
 *   httpGet:
 *     path: /healthcheck
 *     port: 4000
 *   initialDelaySeconds: 10
 *   periodSeconds: 10
 *
 * Liveness Probe (restart decision):
 * livenessProbe:
 *   httpGet:
 *     path: /healthcheck
 *     port: 4000
 *   initialDelaySeconds: 30
 *   periodSeconds: 30
 *
 * MONITORING INTEGRATION:
 *
 * - Prometheus: Scrape health metrics from response
 * - DataDog: Monitor health check response times and status
 * - New Relic: Track service availability and uptime
 * - PagerDuty: Alert on health check failures
 *
 * LOAD BALANCER CONFIGURATION:
 *
 * - Health check URL: /healthcheck
 * - Expected status: 200
 * - Check interval: 10-30 seconds
 * - Timeout: 5 seconds
 * - Failure threshold: 3 consecutive failures
 * - Success threshold: 2 consecutive successes
 *
 * SECURITY CONSIDERATIONS:
 *
 * - Rate limit health check endpoint to prevent abuse
 * - Consider authentication for sensitive health data
 * - Avoid exposing internal system details in production
 * - Monitor for reconnaissance attempts via health checks
 *
 * OPERATIONAL BEST PRACTICES:
 *
 * - Log health check patterns for capacity planning
 * - Alert on health check response time degradation
 * - Use health checks for automated deployment verification
 * - Implement circuit breakers based on dependency health
 * - Monitor health check failure patterns for incident response
 */
