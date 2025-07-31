/**
 * Helmet Security Headers Configuration
 *
 * Helmet sets various HTTP security headers to protect against common web vulnerabilities.
 * This configuration is optimised for GraphQL APIs with optional GraphQL Playground support.
 *
 * Security Headers Applied:
 * - Content Security Policy (CSP): Prevents XSS and code injection attacks
 * - HTTP Strict Transport Security (HSTS): Enforces HTTPS connections
 * - X-Frame-Options: Prevents clickjacking attacks
 * - X-Content-Type-Options: Prevents MIME type confusion attacks
 * - Referrer Policy: Controls referrer information leakage
 * - Cross-Origin Policies: Protects against cross-origin attacks
 *
 * GraphQL-Specific Considerations:
 * - CSP policies must accommodate GraphQL Playground (development only)
 * - API endpoints typically don't need frame embedding or external resources
 * - Security vs Development usability trade-offs
 */

import {HelmetOptions} from 'helmet';
import {graphqlConfiguration} from '../managers/environmentManager';

/**
 * Comprehensive Helmet Security Configuration
 *
 * Balances maximum security with GraphQL API functionality.
 * Conditionally relaxes policies for development tools (GraphQL Playground).
 */
const helmetOptions: Readonly<HelmetOptions> | undefined = {
    /**
     * Cross-Origin Embedder Policy (COEP)
     *
     * Controls whether the document can be embedded in cross-origin contexts.
     * For GraphQL APIs, this is typically disabled unless serving embedded content.
     *
     * Development: Disabled when GraphQL Playground is enabled (needs embedding)
     * Production: Disabled for API-only services (no embedding needed)
     */
    crossOriginEmbedderPolicy: graphqlConfiguration.enablePlayground,

    /**
     * Hide X-Powered-By Header
     *
     * Removes the default "X-Powered-By: Express" header to reduce information disclosure.
     * Prevents attackers from easily identifying the technology stack.
     *
     * Security Impact: LOW - Defense in depth, reduces reconnaissance
     * Performance Impact: NONE
     *
     * Recommendation: ALWAYS ENABLE
     */
    hidePoweredBy: true,

    /**
     * Content Security Policy (CSP)
     *
     * The most important security header - prevents XSS and code injection attacks.
     * Controls which resources (scripts, styles, images) can be loaded and executed.
     *
     * Security Impact: HIGH - Primary defence against XSS attacks
     * Compatibility Impact: HIGH - Can break applications if misconfigured
     *
     * GraphQL Playground Requirements:
     * - 'unsafe-inline' for inline styles and scripts
     * - 'unsafe-eval' for dynamic script execution
     * - These are relaxed ONLY in development when playground is enabled
     */
    contentSecurityPolicy: {
        directives: {
            // Default source policy - only allow same-origin resources
            defaultSrc: ["'self'"],

            // Script execution policy
            scriptSrc: graphqlConfiguration.enablePlayground
                ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Development: Allow playground scripts
                : ["'self'"], // Production: Only same-origin scripts

            // CSS/styling policy
            styleSrc: graphqlConfiguration.enablePlayground
                ? ["'self'", "'unsafe-inline'"] // Development: Allow playground styles
                : ["'self'"], // Production: Only same-origin styles

            // Image loading policy
            imgSrc: [
                "'self'",
                'data:' // Allow data URLs for inline images (common in APIs)
            ],

            // Network connection policy (fetch, XHR, WebSocket)
            connectSrc: ["'self'"], // Only allow connections to same-origin

            // Font loading policy
            fontSrc: ["'self'"], // Only same-origin fonts

            // Object/embed policy (Flash, etc.)
            objectSrc: ["'none'"], // Block all object embeds (security risk)

            // Frame/iframe source policy
            frameSrc: ["'self'"], // Only allow same-origin frames

            // Media (audio/video) policy
            mediaSrc: ["'self'"], // Only same-origin media
        },

    },

    /**
     * HTTP Strict Transport Security (HSTS)
     *
     * Forces browsers to use HTTPS for all future requests to this domain.
     * Prevents downgrade attacks and cookie hijacking over insecure connections.
     *
     * Security Impact: HIGH - Prevents man-in-the-middle attacks
     * Deployment Impact: HIGH - Requires HTTPS to be properly configured
     *
     * CRITICAL WARNING: preload directive is IRREVERSIBLE once submitted to browsers!
     */
    strictTransportSecurity: {
        maxAge: 15552000, // 180 days (recommended minimum for production)
        includeSubDomains: false,  // Don't force HTTPS on all subdomains (may break other services)

        /**
         * 🚨 PRELOAD WARNING 🚨
         *
         * Setting preload: true is IRREVERSIBLE and affects ALL browsers permanently.
         * Only enable if you are 100% certain that:
         * 1. HTTPS is properly configured and will remain so permanently
         * 2. All subdomains can support HTTPS (if includeSubDomains is true)
         * 3. You understand this cannot be undone once browsers include your domain
         *
         * For most applications, leave this as false for safety.
         */
        preload: false
    },

    /**
     * Cross-Origin Opener Policy (COOP)
     *
     * Prevents other origins from gaining references to your window object.
     * Protects against cross-origin attacks that try to manipulate popup windows.
     *
     * Security Impact: MEDIUM - Prevents sophisticated cross-origin attacks
     * Compatibility Impact: LOW - Rarely affects API services
     */
    crossOriginOpenerPolicy: {
        policy: 'same-origin' // Only same-origin can access window references
    },

    /**
     * Cross-Origin Resource Policy (CORP)
     *
     * Controls which origins can include your resources (images, scripts, etc.).
     * For API services, typically restricts to same-origin only.
     *
     * Security Impact: MEDIUM - Prevents resource inclusion attacks
     * API Impact: LOW APIs rarely need cross-origin resource inclusion
     */
    crossOriginResourcePolicy: {
        policy: 'same-origin' // Only same-origin can include resources
    },

    /**
     * Origin-Agent-Cluster
     *
     * Requests that the browser isolate the origin in its own agent cluster.
     * Provides additional isolation between origins for security.
     *
     * Security Impact: LOW - Additional isolation layer
     * Performance Impact: NEGLIGIBLE
     */
    originAgentCluster: true,

    /**
     * X-Frame-Options (Clickjacking Protection)
     *
     * Prevents the page from being embedded in frames/iframes on other domains.
     * Critical for preventing clickjacking attacks.
     *
     * Security Impact: HIGH - Prevents clickjacking attacks
     * API Impact: NONE - APIs typically don't need frame embedding
     *
     * Options:
     * - 'deny': Never allow framing (most secure)
     * - 'sameorigin': Only allow same-origin framing
     * - 'allow-from': Allow specific origins (legacy, use CSP instead)
     */
    frameguard: {
        action: 'deny' // Never allow this API to be framed (most secure for APIs)
    },

    /**
     * Referrer Policy
     *
     * Controls how much referrer information is sent with requests.
     * Balances functionality with privacy/security.
     *
     * Security Impact: MEDIUM - Prevents information leakage
     * Functionality Impact: LOW - Most APIs don't rely on referrer headers
     *
     * 'strict-origin-when-cross-origin':
     * - Same-origin: Send full referrer
     * - Cross-origin HTTPS→HTTPS: Send origin only
     * - Cross-origin HTTPS→HTTP: Send nothing (security)
     */
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin' // Balanced security and functionality
    },

    /**
     * DNS Prefetch Control
     *
     * Controls whether browsers can perform DNS prefetching.
     * For APIs, prefetching is generally safe and can improve performance.
     *
     * Performance Impact: POSITIVE - Faster DNS resolution
     * Security Impact: NEGLIGIBLE
     */
    dnsPrefetchControl: {
        allow: true // Allow DNS prefetching for better performance
    },

    /**
     * X-Content-Type-Options
     *
     * Prevents browsers from MIME-sniffing responses away from the declared content-type.
     * Critical for preventing MIME confusion attacks.
     *
     * Security Impact: HIGH - Prevents MIME confusion attacks
     * Compatibility Impact: NONE - Should always be enabled
     */
    noSniff: true,

    /**
     * Deprecated/Vulnerable Headers (Explicitly Disabled)
     *
     * These headers are disabled because they're either deprecated or provide
     * insufficient security benefits while potentially causing compatibility issues.
     */

    /**
     * X-XSS-Protection (DISABLED)
     *
     * This header is deprecated and can introduce vulnerabilities.
     * Modern browsers ignore it in favour of CSP.
     *
     * Security Impact: NEGATIVE - Can introduce XSS vulnerabilities
     * Recommendation: Always disable in favour of proper CSP
     */
    xssFilter: false,
    /**
     * X-Download-Options (DISABLED)
     *
     * Legacy Internet Explorer security header that's no longer relevant.
     * Modern browsers don't support or need this header.
     *
     * Compatibility Impact: NONE - Only affected old IE versions
     * Recommendation: Disable for cleaner headers
     */
    ieNoOpen: false,
    /**
     * X-Permitted-Cross-Domain-Policies (DISABLED)
     *
     * Controls Adobe Flash and PDF cross-domain policies.
     * No longer relevant as Flash is deprecated, and modern web security
     * relies on CORS and CSP instead.
     *
     * Security Impact: NONE - Flash is deprecated
     * Recommendation: Disable for cleaner headers
     */
    permittedCrossDomainPolicies: false,
};

export default helmetOptions;

/**
 * PRODUCTION DEPLOYMENT CHECKLIST:
 *
 * 1. ✅ Ensure HTTPS is properly configured before enabling HSTS
 * 2. ✅ Test GraphQL Playground is disabled in production (CSP will block it)
 * 3. ✅ Verify CSP doesn't break legitimate client applications
 * 4. ✅ Test API functionality with all security headers enabled
 * 5. ✅ Consider enabling HSTS preload only after thorough testing
 * 6. ✅ Monitor for CSP violations in browser console/logs
 * 7. ✅ Validate headers using security scanning tools
 *
 * DEVELOPMENT CONFIGURATION:
 *
 * - GraphQL Playground requires to be relaxed CSP (unsafe-inline, unsafe-eval)
 * - These relaxations are automatically applied when ENABLE_GRAPHQL_PLAYGROUND=true
 * - Never enable playground in production environments
 *
 * SECURITY TESTING:
 *
 * - Use tools like security headers.com to validate your configuration
 * - Test for XSS vulnerabilities with relaxed CSP in development
 * - Verify HSTS works correctly with your HTTPS setup
 * - Test cross-origin scenarios match your CORS configuration
 *
 * MONITORING RECOMMENDATIONS:
 *
 * - Monitor CSP violation reports for potential attacks or misconfigurations
 * - Track HSTS policy violations (users on HTTP when HTTPS required)
 * - Log security header violations for analysis
 * - Consider implementing CSP reporting endpoints
 *
 * COMMON ISSUES:
 *
 * - CSP blocking legitimate resources: Adjust directives or add specific sources
 * - HSTS preventing HTTP access: Ensure HTTPS is working before enabling
 * - Frame blocking breaking embedded use cases: Consider adjusting frameguard
 * - Referrer policy breaking analytics: May need to adjust based on requirements
 */
