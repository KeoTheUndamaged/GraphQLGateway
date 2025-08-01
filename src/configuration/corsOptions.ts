/**
 * CORS (Cross-Origin Resource Sharing) Configuration
 *
 * CORS controls which web origins can access your GraphQL API from browsers.
 * This is a critical security mechanism that prevents unauthorised cross-origin requests.
 *
 * Security Principles:
 * - Production: Strict domain validation to prevent unauthorised access
 * - Development: Relaxed localhost access for development workflows
 * - Always log blocked origins for security monitoring
 *
 * CORS Attack Vectors Prevented:
 * - Cross-Site Request Forgery (CSRF) via unauthorised origins
 * - Data exfiltration from malicious websites
 * - Unauthorised API access from untrusted domains
 *
 * GraphQL-Specific Considerations:
 * - POST requests for GraphQL mutations require preflight OPTIONS requests
 * - Credentials may be needed for authentication cookies/headers
 * - GraphQL endpoints are typically single URLs (/graphql)
 */


import { serverConfiguration, corsConfiguration } from '../managers/environmentManager';
import {createLogger} from '../managers/loggerManager';

const logger = createLogger(serverConfiguration.logLevel);

/**
 * Dynamic Origin Validation Function
 *
 * Validates incoming request origin against allowed domains.
 * Implements different validation logic for development vs production environments.
 * Now supports multiple allowed origins for production environments.
 *
 * Origin Validation Rules:
 * - Production: Exact domain match or subdomain of any configured domain
 * - Development: Allow localhost on any port for local development
 * - No origin: Allow requests from mobile apps, Postman, server-to-server calls
 *
 * @param origin - The origin header from the incoming request (undefined for same-origin requests)
 * @param callback - CORS callback function to allow/deny the request
 */
const allowedOrigins = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin header
    // This includes:
    // - Mobile app requests (React Native, Flutter, etc.)
    // - Server-to-server API calls
    // - Development tools (Postman, curl, etc.)
    // - Same-origin requests from the same domain
    if (!origin) {
        callback(null, true);
        return;
    }

    try {
        // Parse the origin URL to extract the hostname
        // This handles full URLs like "https://app.example.com:3000"
        const hostname = new URL(origin).hostname;

        // Environment-specific domain validation
        let allowedDomains: string[];

        if (serverConfiguration.nodeEnv === 'production') {
            // Production: Parse allowed origins from configuration
            // Support both single domain and comma-separated list
            allowedDomains = corsConfiguration.allowedOrigins
                .split(',')
                .map(domain => domain.trim())
                .filter(domain => domain.length > 0);
        } else {
            // Development: Allow localhost
            allowedDomains = ['localhost'];
        }

        // Check if hostname matches any allowed domain
        // Flexible domain matching logic
        // Allows both exact matches and subdomain access
        // Examples for domains "example.com,test.com":
        // ✅ example.com (exact match)
        // ✅ app.example.com (subdomain)
        // ✅ test.com (exact match)
        // ✅ api.test.com (subdomain)
        // ❌ malicious-example.com (not a real subdomain)

        const isAllowed = allowedDomains.some(allowedDomain =>
            hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`)
        );

        if (isAllowed) {
            // Log successful origin validation for monitoring
            logger.debug('CORS origin allowed', {
                origin: origin,
                hostname: hostname,
                allowedDomains: allowedDomains,
                environment: serverConfiguration.nodeEnv
            });
            callback(null, true);
        } else {
            // Log blocked origins for security monitoring
            // This helps identify potential attacks or misconfigured clients
            logger.warn('CORS origin blocked', {
                origin: origin,
                hostname: hostname,
                allowedDomains: allowedDomains,
                environment: serverConfiguration.nodeEnv,
                reason: 'Domain not in allowed list'
            });

            callback(new Error('Not allowed by CORS'));
        }
    } catch (err) {
        // Handle malformed origin URLs
        // Attackers might send invalid URLs to probe for vulnerabilities
        logger.warn('CORS invalid origin format', {
            origin: origin,
            error: err instanceof Error ? err.message : String(err),
            reason: 'Malformed origin URL'
        });

        callback(new Error('Invalid origin'));
    }
}

/**
 * CORS Configuration Object
 *
 * Configures the Express CORS middleware with GraphQL-optimized settings.
 * Balances security with the functional requirements of GraphQL APIs.
 */

const corsOptions = {
    /**
     * Allowed HTTP Methods
     *
     * GraphQL APIs typically only need:
     * - GET: For GraphQL queries via GET (if enabled)
     * - POST: For GraphQL queries and mutations
     * - OPTIONS: For CORS preflight requests
     *
     * Restricting methods reduces attack surface.
     */
    methods: ['GET', 'POST', 'OPTIONS'],
    /**
     * Allowed Request Headers
     *
     * Essential headers for GraphQL APIs:
     * - Content-Type: Required for JSON request bodies
     * - Authorization: For authentication tokens (JWT, API keys, etc.)
     *
     * Additional headers can be added as needed:
     * - X-Request-ID: For request tracing
     * - X-Client-Version: For client version tracking
     */
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-Client-Version',
        'Apollo-Require-Preflight', // Apollo Client specific
    ],
    /**
     * Credentials Support
     *
     * Enables sending cookies and authorisation headers with cross-origin requests.
     * Required for:
     * - Authentication cookies
     * - HTTP-only session cookies
     * - Authorisation headers
     *
     * Security Note: Only enable if you need authentication across origins.
     * When credentials are enabled, origin validation becomes more critical.
     */
    credentials: true,
    /**
     * Preflight Cache Duration
     *
     * How long browsers can cache preflight responses (in seconds)
     * 86,400 seconds = 24 hours
     *
     * Benefits:
     * - Reduces preflight request overhead
     * - Improves client performance
     * - Reduces server load
     *
     * Considerations:
     * - Longer cache means slower propagation of CORS policy changes
     * - 24 hours is a good balance for most applications
     */
    maxAge: 86400,
    /**
     * Dynamic Origin Validation
     *
     * Uses the allowedOrigins function for flexible, environment-aware validation.
     * This is more secure than a static allowlist for multienvironment deployments.
     */
    origin: allowedOrigins,
};

export default corsOptions;

/**
 * PRODUCTION DEPLOYMENT CHECKLIST:
 *
 * 1. ✅ Set CORS_ALLOWED_DOMAIN environment variable to your production domains (comma-separated)
 * 2. ✅ Verify subdomain access works as expected (app.domain.com, api.domain.com)
 * 3. ✅ Test CORS with your actual frontend applications
 * 4. ✅ Monitor logs for blocked origins (potential attacks or misconfigurations)
 * 5. ✅ Consider disabling credentials if not needed for better security
 * 6. ✅ Validate that preflight requests work correctly for your GraphQL mutations
 *
 * DEVELOPMENT SETUP:
 *
 * - Set NODE_ENV=development for automatic localhost access
 * - Frontend running on http://localhost:3000 will be automatically allowed
 * - No need to configure CORS_ALLOWED_DOMAIN in development
 *
 * MULTIPLE ORIGINS SETUP:
 *
 * - Set CORS_ALLOWED_DOMAIN=example.com,test.com for multiple domains
 * - Supports both exact matches and subdomains for each domain
 * - example.com allows: example.com, app.example.com, api.example.com
 * - test.com allows: test.com, staging.test.com, app.test.com
 *
 * SECURITY BEST PRACTICES:
 *
 * - Never use '*' for allowed origins in production
 * - Monitor CORS rejection logs for attack patterns
 * - Consider implementing rate limiting for CORS violations
 * - Use HTTPS in production to prevent origin spoofing
 * - Validate that your domain validation logic is bulletproof
 * - Keep the list of allowed origins as minimal as possible
 *
 * TROUBLESHOOTING COMMON ISSUES:
 *
 * - "CORS error" in browser: Check origin validation and allowed methods
 * - Preflight failures: Verify OPTIONS method is allowed and headers are correct
 * - Credentials issues: Ensure both server and client enable credentials
 * - Mobile app issues: Verify requests without an origin header are allowed
 * - Multiple origins: Ensure domains are comma-separated without spaces
 *
 * MONITORING RECOMMENDATIONS:
 *
 * - Alert on high rates of CORS rejections (potential attack)
 * - Track origins attempting access for security analysis
 * - Monitor for new legitimate origins that need to be allowlisted
 * - Log timing of CORS policy changes for troubleshooting
 */