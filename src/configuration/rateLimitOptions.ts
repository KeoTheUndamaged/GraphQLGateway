/**
 * Express Rate Limiting Configuration
 *
 * Rate limiting is a critical security mechanism that prevents abuse and DoS attacks.
 * This configuration protects against various attack vectors while maintaining usability.
 *
 * Attack Vectors Prevented:
 * - Brute force attacks (password/token guessing)
 * - Denial of Service (DoS) attacks via request flooding
 * - Resource exhaustion attacks on expensive GraphQL operations
 * - API scraping and unauthorised data harvesting
 * - Credential stuffing attacks
 *
 * GraphQL-Specific Considerations:
 * - Single endpoint (/graphql) receives all queries and mutations
 * - Query complexity varies dramatically (simple field vs deep nested queries)
 * - Introspection queries can be expensive but legitimate
 * - Subscriptions may require different rate-limiting strategies
 *
 * Rate Limiting Strategy:
 * - Global rate limiting for basic protection
 * - Should be combined with Apollo Armour query complexity analysis
 * - Consider implementing query-specific rate limits for expensive operations
 */

import {rateLimitConfiguration, serverConfiguration} from '../managers/environmentManager';
import {createLogger} from '../managers/loggerManager';

const logger = createLogger(serverConfiguration.logLevel);

/**
 * Enhanced Rate Limiting Configuration
 *
 * Uses express-rate-limit with GraphQL-optimised settings.
 * Provides protection while accommodating legitimate usage patterns.
 */
const rateLimitOptions = {
    /**
     * Time Window for Rate Limiting (milliseconds)
     *
     * The time period over which requests are counted.
     * After this period, the request count resets to zero for each client.
     *
     * Common Values:
     * - 60000 (1 minute): Good for APIs with moderate usage
     * - 900000 (15 minutes): Standard for authentication endpoints
     * - 3600000 (1 hour): Suitable for expensive operations
     *
     * GraphQL Considerations:
     * - Shorter windows provide faster recovery from legitimate spikes
     * - Longer windows provide better protection against sustained attacks
     * - Consider your typical user interaction patterns
     *
     * Configured via: RATE_LIMIT_WINDOW_MS environment variable
     */
    windowMs: rateLimitConfiguration.rateLimitWindow,
    /**
     * Maximum Requests Per Window
     *
     * The maximum number of requests is allowed from a single IP address
     * within the specified time window.
     *
     * Tuning Guidelines:
     * - Consider your heaviest legitimate user workflows
     * - Account for GraphQL batched requests if enabled
     * - Factor in frontend auto-refresh/polling intervals
     * - Leave headroom for legitimate usage spikes
     *
     * Example Calculations:
     * - User browsing app: 1-3 queries per page, 10 pages = 30 requests
     * - Real-time dashboard: 1 query every 30 seconds = 120/hour
     * - Data import process: May need much higher limits
     *
     * Configured via: RATE_LIMIT_MAX environment variable
     */
    limit: rateLimitConfiguration.rateLimitMax,

    /**
     * Rate Limit Response Headers
     *
     * Controls which headers are sent to inform clients about rate limits.
     * Helps well-behaved clients implement proper backoff strategies.
     *
     * Headers included:
     * - X-RateLimit-Limit: Maximum requests allowed
     * - X-RateLimit-Remaining: Requests remaining in the current window
     * - X-RateLimit-Reset: When the current window resets
     * - Retry-After: How long to wait before retrying (when limited)
     */
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,  // Disable the `X-RateLimit-*` headers (use standardHeaders instead)

    /**
     * Rate Limit Exceeded Response
     *
     * Customises the response when the rate-limit is exceeded.
     * Provides helpful information to legitimate clients while not revealing too much to attackers.
     */
    handler: (req: any, res: any) => {
        // Log rate limit violations for security monitoring
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString(),
        });

        // Return structured error response
        res.status(429).json({
            error: {
                message: 'Too many requests from this IP, please try again later.',
                code: 'RATE_LIMIT_EXCEEDED',
                type: 'RateLimitError',
                // Provide helpful information for legitimate clients
                details: {
                    limit: rateLimitConfiguration.rateLimitMax,
                    windowMs: rateLimitConfiguration.rateLimitWindow,
                    retryAfter: Math.ceil(rateLimitConfiguration.rateLimitWindow / 1000), // seconds
                },
            }
        });
    },


}

export default rateLimitOptions;

/**
 * PRODUCTION DEPLOYMENT CHECKLIST:
 *
 * 1. ✅ Configure appropriate rate limits based on expected traffic patterns
 * 2. ✅ Set up monitoring and alerting for rate limit violations
 * 3. ✅ Test rate limiting with realistic load testing
 * 4. ✅ Configure external store (Redis) for multi-instance deployments
 * 5. ✅ Implement user-specific or API key-based rate limiting if needed
 * 6. ✅ Document rate limits for API consumers
 * 7. ✅ Set up dashboards to monitor rate limiting effectiveness
 *
 * RATE LIMIT TUNING GUIDE:
 *
 * Starting Values (adjust based on your needs):
 * - Development: 1000 requests/hour (relaxed for testing)
 * - Staging: 500 requests/hour (closer to production)
 * - Production: 100-300 requests/hour (depends on a use case)
 *
 * Factors to Consider:
 * - Average queries per user session
 * - Peak usage periods and patterns
 * - GraphQL query complexity and execution time
 * - Infrastructure capacity and scaling strategy
 * - Business requirements and user experience
 *
 * MONITORING RECOMMENDATIONS:
 *
 * Key Metrics to Track:
 * - Rate limit hit rate (% of requests that hit limits)
 * - Top IPs hitting rate limits (potential attackers vs legitimate users)
 * - Rate limit violation patterns (time of day, geographic distribution)
 * - False positive rate (legitimate users being blocked)
 *
 * Alerting Thresholds:
 * - High rate limit violation rate (potential attack)
 * - Sustained violations from a single IP (likely attack)
 * - Sudden spike in violations (DDoS attempt)
 *
 * ADVANCED CONFIGURATIONS:
 *
 * Progressive Rate Limiting:
 * - Implement escalating penalties for repeat violators
 * - Temporary bans for sustained abuse
 * - Allowlist trusted IPs/users
 *
 * Query-Specific Limits:
 * - Different limits for expensive vs simple queries
 * - Special handling for introspection queries
 * - Batch request considerations
 *
 * Geographic Considerations:
 * - Different limits by region
 * - Account for CDN and proxy impacts
 * - Handle legitimate traffic spikes from specific regions
 */
