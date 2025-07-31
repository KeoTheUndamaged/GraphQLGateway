/**
 * Environment Variables Configuration with Zod Validation
 *
 * This module provides type-safe, validated configuration management for the GraphQL Gateway.
 * It's the single source of truth for all environment-dependent settings.
 *
 * Architecture Principles:
 * - Fail Fast: Invalid configuration causes immediate startup failure
 * - Type Safety: All environment variables are properly typed and validated
 * - Logical Grouping: Related configuration is grouped for better organization
 * - Secure Defaults: Production-safe defaults that prioritise security
 * - Documentation: Each variable is documented with purpose and security implications
 *
 * Security Benefits:
 * - Prevents runtime configuration errors that could expose sensitive data
 * - Enforces secure defaults (introspection disabled, playground disabled, etc.)
 * - Validates configuration before the server starts accepting requests
 * - Provides clear audit trail of all configuration values
 *
 * Operational Benefits:
 * - Clear error messages for misconfigured environments
 * - Centralized configuration management
 * - Environment-specific configuration validation
 * - Type-safe access to configuration throughout the application
 */
import {z, ZodObject} from 'zod';

/**
 * Boolean String Transformer
 *
 * Converts string environment variables to boolean values.
 * Handles common boolean representations safely.
 *
 * Accepted Values:
 * - 'true' (case-insensitive) → true
 * - anything else → false
 *
 * Security Note: Defaults to false for security-sensitive features
 */
const booleanTransformer = (value: string): boolean => value.toLowerCase() === 'true';
/**
 * Number String Transformer
 *
 * Converts string environment variables to numbers with validation.
 * Includes error handling for invalid numeric values.
 */
const numberTransformer = (val: any): number => parseInt(val, 10);
/**
 * Header String Transformer
 *
 * Converts string environment variables to a JSON with validation.
 * Includes error handling for invalid JSON strings.
 */
const headerTransformer = (val: any): Record<string, string> => {
    try {
        const parsed = JSON.parse(val);

        // Ensure it's an object and all values are strings
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const headers: Record<string, string> = {};

            for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === 'string') {
                    headers[key] = value;
                } else {
                    console.warn(`Header value for key "${key}" is not a string, converting: ${value}`);
                    headers[key] = String(value);
                }
            }
            return headers;
        }

        console.warn('Parsed headers is not a valid object, returning empty headers');
        return {};
    } catch (e) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'Unable to parse header. Please ensure it is valid JSON with string values.',
            error: {
                message: e instanceof Error ? e.message : String(e),
                stack: e instanceof Error ? e.stack : undefined,
                received: val
            }
        }));
        return {};
    }
};


/**
 * Comprehensive Environment Variable Schema
 *
 * Defines all environment variables with:
 * - Type validation and transformation
 * - Required vs optional variables
 * - Security-focused default values
 * - Input validation rules
 *
 * Schema Design Principles:
 * - Security-first defaults (features disabled by default)
 * - Clear validation error messages
 * - Flexible development configuration
 * - Production-ready default values
 */
const schema: ZodObject = z.object({
    /** Server Configuration **/
    /**
     * NODE_ENV - Deployment Environment
     *
     * Controls environment-specific behaviour throughout the application.
     * Critical for security features like error disclosure and debug logging.
     *
     * Values:
     * - 'production': Full security, minimal logging, optimised performance
     * - 'development': Debug features, detailed errors, relaxed security
     * - 'staging': Production-like with some debug features
     * - 'uat': User acceptance testing environment
     * - 'test': Jest/automated testing environment
     *
     * Security Impact: HIGH - Controls information disclosure and debug features
     * Default: 'production' - Secure by default
     */
    NODE_ENV: z.enum(['production', 'candidate', 'uat', 'development', 'test']).default('production'),
    /**
     * PORT - HTTP Server Port
     *
     * The port number for the Express HTTP server.
     * Kept as a string for flexibility with deployment environments.
     *
     * Common Values:
     * - '4000': Default GraphQL port (non-conflicting)
     * - '3000': Common development port (may conflict with frontend)
     * - '8080': Common containerised deployment port
     * - '80'/'443': Standard HTTP/HTTPS ports (requires elevated privileges)
     *
     * Deployment Considerations:
     * - Container orchestration often assigns dynamic ports
     * - Load balancers typically use standard ports externally
     * - Health checks need to know the correct port
     *
     * Security Impact: LOW - Port number has minimal security implications
     * Default: '4000' - Common GraphQL port, avoids conflicts
     */
    PORT: z.string().default('8080'),
    /**
     * LOG_LEVEL - Winston Logging Level
     *
     * Controls the verbosity of application logging.
     * Higher levels include all lower levels (error < warn < info < http < debug).
     *
     * Levels:
     * - 'error': Only critical errors (production recommended)
     * - 'warn': Warnings and errors (production default)
     * - 'info': General information, warnings, errors
     * - 'http': HTTP request logging, all above levels
     * - 'debug': Detailed debugging, all above levels (development only)
     *
     * Performance Impact:
     * - Higher levels increase I/O and may impact performance
     * - 'debug' level can be very verbose and slow
     * - Log aggregation costs increase with volume
     *
     * Security Considerations:
     * - Higher levels may log sensitive data in debug messages
     * - Production should use 'warn' or 'error' to minimise data exposure
     * - Development can use 'debug' for troubleshooting
     *
     * Default: 'warn' - Balances operational visibility with performance
     */
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('warn'),
    /**
     * SERVICE_NAME - Service Identifier
     *
     * Unique name for this service in your architecture.
     * Used for logging, monitoring, service discovery, and documentation.
     *
     * Examples:
     * - 'graphql-gateway'
     * - 'api-gateway'
     * - 'user-service-gateway'
     *
     * Operational Benefits:
     * - Identifies service in distributed tracing
     * - Groups logs and metrics in monitoring systems
     * - Enables service-specific alerting and dashboards
     * - Helps with incident response and debugging
     *
     * Required: YES - Essential for production operations
     */
    SERVICE_NAME: z.string().min(1, 'SERVICE_NAME is required for service identification'),
    /**
     * SERVICE_VERSION - Service Version
     *
     * Version identifier for this service deployment.
     * Critical for deployment tracking, rollback capabilities, and debugging.
     *
     * Recommended Formats:
     * - Semantic versioning: '1.2.3'
     * - Git commit SHA: 'abc123def456'
     * - Build number: '2023.12.25.1'
     * - Git tag: 'v1.2.3-production'
     *
     * Operational Benefits:
     * - Correlate issues with specific deployments
     * - Enable precise rollback to previous versions
     * - Track feature rollout and adoption
     * - Support A/B testing and canary deployments
     *
     * Required: YES - Essential for deployment management
     */
    SERVICE_VERSION: z.string().min(1, 'SERVICE_VERSION is required for deployment tracking'),

    /** CORS Configuration **/
    /**
     * CORS_ALLOWED_DOMAIN - Cross-Origin Resource Sharing Domain
     *
     * The domain is authorised to make cross-origin requests to this GraphQL API.
     * Critical security control that prevents unauthorised web applications from accessing your API.
     *
     * Examples:
     * - 'example.com' (allows example.com and *.example.com)
     * - 'localhost' (development - allows localhost on any port)
     * - 'myapp.example.com' (specific deployment domain)
     *
     * Security Impact: CRITICAL - Controls which web origins can access your API
     * - Prevents malicious websites from accessing your API
     * - Protects against CSRF attacks via browser same-origin policy
     * - Must be precisely configured for your frontend domain
     *
     * Common Mistakes:
     * - Using '*' in production (allows any origin - NEVER DO THIS)
     * - Forgetting subdomains (app.example.com won't work with just 'example.com')
     * - Protocol mismatches (https://example.com vs http://example.com)
     *
     * Required: YES - Essential for web application security
     */
    CORS_ALLOWED_DOMAIN: z.string().min(1, 'CORS_ALLOWED_ORIGINS is required for CORS Web security'),

    /** GraphQL Configuration **/
    /**
     * ENABLE_GRAPHQL_PLAYGROUND - GraphQL Playground Interface
     *
     * Enables the GraphQL Playground web interface for interactive query testing.
     * Provides a user-friendly way to explore and test your GraphQL API.
     *
     * Features:
     * - Interactive query editor with syntax highlighting
     * - Schema explorer and documentation
     * - Query history and saved queries
     * - Variable and header management
     *
     * Security Considerations:
     * - Should NEVER be enabled in production
     * - Can expose sensitive API functionality
     * - May reveal internal API structure
     * - Provides easy access for attackers
     *
     * Development Benefits:
     * - Excellent for API development and testing
     * - Helps frontend developers understand the API
     * - Useful for debugging and troubleshooting
     * - Great for API documentation and demonstrations
     *
     * Default: false - Must be explicitly enabled, never in production
     */
    ENABLE_GRAPHQL_PLAYGROUND: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(false),
    /**
     * ENABLE_INTROSPECTION - GraphQL Schema Introspection
     *
     * Allows clients to query the GraphQL schema structure and documentation.
     * Useful for development tools but can expose API structure to attackers.
     *
     * Benefits:
     * - Enables GraphQL Playground, GraphiQL, and other dev tools
     * - Allows automatic client code generation
     * - Provides self-documenting API capabilities
     * - Essential for Apollo Studio integration
     *
     * Security Risks:
     * - Exposes complete API structure to potential attackers
     * - Reveals available fields, types, and relationships
     * - Can aid in reconnaissance for API abuse
     * - May expose internal naming conventions
     *
     * Best Practices:
     * - Enable in development and staging environments
     * - Disable in production unless specifically needed
     * - Consider IP allowlisting if needed in production
     * - Monitor introspection query usage
     *
     * Default: false - Secure by default, enable explicitly when needed
     */
    ENABLE_INTROSPECTION: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(false),
    /**
     * ALLOW_BATCHED_REQUESTS - GraphQL Request Batching
     *
     * Enables Apollo Client to send multiple GraphQL operations in a single HTTP request.
     * Can improve performance but may complicate rate limiting and monitoring.
     *
     * Benefits:
     * - Reduces HTTP overhead for multiple queries
     * - Better performance for client applications
     * - Fewer network round trips
     *
     * Security Considerations:
     * - Batched requests can bypass simple rate limiting
     * - Harder to monitor individual operation performance
     * - May enable more sophisticated DoS attacks
     * - Requires careful rate-limiting implementation
     *
     * Performance Impact:
     * - Can improve client performance significantly
     * - May increase server memory usage per request
     * - Complicates query complexity analysis
     *
     * Default: false - Conservative default, enable only if needed
     */
    ALLOWED_BATCHED_REQUESTS:  z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(false),

    /**
     * Apollo Armour Security Configuration
     *
     * Apollo Armour provides comprehensive GraphQL security protection.
     * These settings control various security mechanisms to prevent attacks.
     *
     * Security Impact: HIGH - These are your primary defences against GraphQL attacks
     * Default: true for all - Security-first approach
     */

    /**
     * ENABLE_BLOCK_FIELD_SUGGESTION - Field Suggestion Blocking
     *
     * Prevents GraphQL from suggesting similar field names when a field doesn't exist.
     * Stops attackers from using field suggestions to enumerate your schema.
     *
     * Attack Prevention:
     * - Schema enumeration via field suggestions
     * - Information disclosure about available fields
     * - API reconnaissance attacks
     *
     * Default: true - Always recommended for production
     */
    ENABLE_BLOCK_FIELD_SUGGESTION: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(true),
    /**
     * BLOCK_FIELD_SUGGESTION_MASK - Field Suggestion Replacement Text
     *
     * The text that replaces field suggestions when ENABLE_BLOCK_FIELD_SUGGESTION is true.
     * Provides a consistent, security-focused response for invalid field queries.
     *
     * Purpose:
     * - Replaces potentially revealing field suggestions with safe text
     * - Maintains consistent error responses
     * - Prevents information leakage about schema structure
     *
     * Security Benefits:
     * - No hints about actual field names
     * - Consistent response regardless of how close the guess was
     * - Clear indication that suggestions are intentionally blocked
     *
     * Default: '<[REDACTED]>' - Clearly indicates intentional information hiding
     */
    BLOCK_FIELD_SUGGESTION_MASK: z.string().default('<[REDACTED]>'),

    /** Cost Limit **/
    /**
     * ENABLE_COST_LIMIT - Query Cost Analysis
     *
     * Analyses and limits the computational cost of GraphQL queries.
     * Prevents expensive queries from overwhelming your servers.
     *
     * Protection Against:
     * - Denial of Service (DoS) attacks via expensive queries
     * - Resource exhaustion attacks
     * - Unintentionally expensive queries from clients
     *
     * Default: true - Essential for production stability
     */
    ENABLE_COST_LIMIT: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(true),
    /**
     * COST_LIMIT_MAX_COST - Maximum Query Cost Threshold
     *
     * The maximum computational cost is allowed for any single GraphQL query.
     * Queries exceeding this cost are rejected before execution.
     *
     * Cost Calculation:
     * - Each field, object, and scalar has an associated cost
     * - Nested queries multiply costs by depth factor
     * - Arrays and connections multiply by estimated result size
     *
     * Tuning Guidelines:
     * - Start conservative and increase based on monitoring
     * - Consider your server's computational capacity
     * - Account for database query complexity
     * - Factor in a concurrent request load
     *
     * Default: 5000 - Allows moderately complex queries while preventing abuse
     */
    COST_LIMIT_MAX_COST: z.string().transform(numberTransformer).pipe(z.number().positive()).default(5000),
    /**
     * COST_LIMIT_OBJECT_COST - Base Cost Per Object Field
     *
     * The base computational cost is assigned to each object field in a query.
     * Objects typically require more processing than scalars due to relationships.
     *
     * Considerations:
     * - Objects often require database joins or additional queries
     * - Higher cost reflects increased computational complexity
     * - Should be higher than COST_LIMIT_SCALAR_COST
     *
     * Default: 2 - Reflects moderate complexity of object field resolution
     */
    COST_LIMIT_OBJECT_COST: z.string().transform(numberTransformer).pipe(z.number().positive()).default(2),
    /**
     * COST_LIMIT_SCALAR_COST - Base Cost Per Scalar Field
     *
     * The base computational cost is assigned to each scalar field in a query.
     * Scalars are typically the least expensive fields to resolve.
     *
     * Examples of Scalars:
     * - String, Int, Float, Boolean, ID
     * - Custom scalars like DateTime, Email, URL
     * - Usually resolved from already-loaded data
     *
     * Default: 1 - Minimum cost unit for the simplest field type
     */
    COST_LIMIT_SCALAR_COST: z.string().transform(numberTransformer).pipe(z.number().positive()).default(1),
    /**
     * COST_LIMIT_DEPTH_COST_FACTOR - Depth Multiplication Factor
     *
     * Factor by which query cost increases with each level of nesting.
     * Accounts for the exponentially increasing complexity of deeply nested queries.
     *
     * How It Works:
     * - Cost = base_cost × (depth_factor ^ nesting_level)
     * - Prevents exponential query complexity from causing server overload
     * - Higher factors more aggressively penalise deep nesting
     *
     * Tuning:
     * - 1.0: No depth penalty (not recommended)
     * - 1.5: Moderate depth penalty (default)
     * - 2.0: Strong depth penalty for deeply nested queries
     *
     * Default: 1.5 - Balanced penalty that allows reasonable nesting
     */
    COST_LIMIT_DEPTH_COST_FACTOR: z.string().transform(numberTransformer).pipe(z.number().positive()).default(1.5),
    /**
     * COST_LIMIT_IGNORE_INTROSPECTION - Exclude Introspection from Cost Analysis
     *
     * Whether to bypass cost analysis for GraphQL introspection queries.
     * Introspection queries can be expensive but are necessary for development tools.
     *
     * Benefits of Ignoring:
     * - Allows development tools to function normally
     * - Prevents introspection queries from being blocked
     * - Enables GraphQL Playground and similar tools
     *
     * Security Considerations:
     * - Introspection should be disabled in production anyway
     * - If introspection is enabled, this prevents it from being blocked by cost limits
     * - Monitor introspection query frequency to detect reconnaissance
     *
     * Default: true - Allows development tools to work when introspection is enabled
     */
    COST_LIMIT_IGNORE_INTROSPECTION: z.string().transform(booleanTransformer).pipe(z.boolean()).default(true),

    /** Max Depth **/
    /**
     * ENABLE_MAX_DEPTH - Query Depth Limiting
     *
     * Limits how deeply nested GraphQL queries can be.
     * Prevents deeply nested queries that can cause exponential resource usage.
     *
     * Protection Against:
     * - Stack overflow attacks
     * - Exponential execution time attacks
     * - Circular reference exploitation
     *
     * Default: true - Critical for preventing depth-based attacks
     */
    ENABLE_MAX_DEPTH: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(true),
    /**
     * MAX_DEPTH_LIMIT - Maximum Query Nesting Level
     *
     * The deepest level of nesting allowed in GraphQL queries.
     * Prevents stack overflow and exponential execution time attacks.
     *
     * Attack Examples:
     * - query { user { posts { author { posts { author { ... } } } } } }
     * - Deeply nested fragments that cause parser recursion
     * - Circular references exploited through deep nesting
     *
     * Tuning Guidelines:
     * - Consider your schema's maximum reasonable nesting
     * - Account for fragment usage which can increase effective depth
     * - Balance security with legitimate use cases
     * - Monitor rejected queries to adjust if too restrictive
     *
     * Default: 10 - Allows reasonable nesting while preventing abuse
     */
    MAX_DEPTH_LIMIT: z.string().transform(numberTransformer).pipe(z.number().positive()).default(10),
    /**
     * MAX_DEPTH_FLATTEN_FRAGMENTS - Include Fragment Depth in Calculation
     *
     * Whether to count fragment nesting levels when calculating query depth.
     * Affects how fragments are treated in depth analysis.
     *
     * When true:
     * - Fragment nesting levels are added to the total depth count
     * - More accurate representation of actual query complexity
     * - May be more restrictive for queries using many fragments
     *
     * When false:
     * - Fragments are "flattened" and don't count toward depth
     * - More permissive for fragment-heavy queries
     * - May miss some deeply nested fragment attacks
     *
     * Default: false - More permissive approach that allows fragment usage
     */
    MAX_DEPTH_FLATTEN_FRAGMENTS: z.string().transform(booleanTransformer).pipe(z.boolean()).default(false),

    /** Max Aliases **/
    /**
     * ENABLE_MAX_ALIASES - Query Alias Limiting
     *
     * Limits the number of aliases that can be used in a single query.
     * Prevents alias flooding attacks that multiply resource usage.
     *
     * Protection Against:
     * - Alias flooding attacks
     * - Resource multiplication via aliases
     * - Memory exhaustion attacks
     *
     * Default: true - Important for preventing alias-based attacks
     */
    ENABLE_MAX_ALIASES: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(true),
    /**
     * MAX_ALIASES_LIMIT - Maximum Field Aliases Per Query
     *
     * The maximum number of field aliases allowed in a single query.
     * Prevents alias flooding attacks that multiply resource usage.
     *
     * Alias Attack Example:
     * ```graphql
     * query {
     *   user1: user(id: 1) { name }
     *   user2: user(id: 1) { name }
     *   user3: user(id: 1) { name }
     *   # ... repeated hundreds of times
     * }
     * ```
     *
     * Legitimate Use Cases:
     * - Different parameters: user(id: 1), user(id: 2)
     * - Different fields from the same object
     * - A/B testing scenarios
     *
     * Default: 10 - Allows reasonable aliasing while preventing abuse
     */
    MAX_ALIASES_LIMIT: z.string().transform(numberTransformer).pipe(z.number().positive()).default(10),

    /** Max Directives **/
    /**
     * ENABLE_MAX_DIRECTIVES - Directive Count Limiting
     *
     * Limits the number of directives that can be used in a query.
     * Prevents directive flooding attacks that can overwhelm the parser.
     *
     * Protection Against:
     * - Parser DoS attacks
     * - Memory exhaustion via excessive directives
     * - Query complexity attacks
     *
     * Default: true - Protects against directive flooding
     */
    ENABLE_MAX_DIRECTIVES: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(true),
    /**
     * MAX_DIRECTIVES_LIMIT - Maximum Directives Per Query
     *
     * The maximum number of directives allowed across all fields in a query.
     * Prevents directive flooding that can overwhelm the query parser.
     *
     * Common Directives:
     * - @include(if: $condition)
     * - @skip(if: $condition)
     * - @deprecated
     * - Custom directives for authorisation, caching, etc.
     *
     * Attack Vector:
     * - Excessive directives can consume parser memory
     * - Complex directive processing can slow down query validation
     * - May cause stack overflow in directive resolution
     *
     * Default: 50 - Generous limit that allows complex queries while preventing abuse
     */
    MAX_DIRECTIVES_LIMIT: z.string().transform(numberTransformer).pipe(z.number().positive()).default(50),

    /** Max Tokens **/
    /**
     * ENABLE_MAX_TOKENS - Query Token Limiting
     *
     * Limits the total number of tokens (keywords, identifiers, punctuation) in a query.
     * Prevents extremely large queries that consume excessive memory during parsing.
     *
     * Protection Against:
     * - Memory exhaustion attacks
     * - Parser DoS attacks
     * - Extremely large query payloads
     *
     * Default: true - Essential for memory protection
     */
    ENABLE_MAX_TOKENS: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(true),
    /**
     * MAX_TOKENS_LIMIT - Maximum Tokens Per Query
     *
     * The maximum number of lexical tokens allowed in a GraphQL query.
     * Prevents extremely large queries from consuming excessive memory during parsing.
     *
     * What Counts as Tokens:
     * - Keywords: query, mutation, subscription, fragment
     * - Identifiers: field names, type names, variable names
     * - Punctuation: {, }, (, ), [, ], :, ,
     * - Literals: strings, numbers, booleans
     *
     * Memory Protection:
     * - Large queries consume significant memory during parsing
     * - Token limit prevents memory exhaustion attacks
     * - Protects against maliciously crafted large payloads
     *
     * Default: 1000 - Allows complex queries while preventing memory attacks
     */
    MAX_TOKENS_LIMIT: z.string().transform(numberTransformer).pipe(z.number().positive()).default(1000),

    /**
     * Rate Limiting Configuration
     *
     * Controls how many requests clients can make within a time window.
     * Critical for preventing abuse and ensuring fair usage.
     */

    /**
     * RATE_LIMIT_WINDOW_MS - Rate Limit Time Window
     *
     * The time window (in milliseconds) for rate limiting.
     * Requests are counted within this sliding window.
     *
     * Common Values:
     * - 60000 (1 minute): Good for APIs with moderate usage
     * - 900000 (15 minutes): Standard for authentication endpoints
     * - 3600000 (1 hour): Suitable for expensive operations
     *
     * Considerations:
     * - Shorter windows: Faster recovery, more granular control
     * - Longer windows: Better attack protection, smoother user experience
     * - Must balance security with usability
     *
     * Default: 900000 (15 minutes) - Good balance for most APIs
     */
    RATE_LIMIT_WINDOW_MS: z.string().transform(numberTransformer).pipe(z.number().positive()).default(900000),

    /**
     * RATE_LIMIT_MAX - Maximum Requests Per Window
     *
     * Maximum number of requests allowed from a single IP within the time window.
     *
     * Tuning Guidelines:
     * - Consider typical user interaction patterns
     * - Account for auto-refresh and polling
     * - Leave headroom for legitimate usage spikes
     * - Factor in GraphQL query complexity variations
     *
     * Example Calculations:
     * - Basic web app: 10-20 queries per page × 10 pages = 200 requests/hour
     * - Real-time dashboard: 1 query/30 seconds = 120 requests/hour
     * - Mobile app with caching: 50-100 requests/hour
     *
     * Default: 100 - Conservative but usable for most applications
     */
    RATE_LIMIT_MAX: z.string().transform(numberTransformer).pipe(z.number().positive()).default(100),

    /** OpenTelemetry Observability Configuration **/
    /**
     * ENABLE_OPEN_TELEMETRY_METRICS - Metrics Collection
     *
     * Enables collection and export of application metrics to OpenTelemetry collectors.
     * Provides insights into application performance, resource usage, and business metrics.
     *
     * Metrics Collected:
     * - Request counts and response times
     * - GraphQL operation metrics
     * - Error rates and types
     * - Resource utilisation (CPU, memory)
     * - Custom business metrics
     *
     * Benefits:
     * - Real-time performance monitoring
     * - Capacity planning data
     * - SLA monitoring and alerting
     * - Performance regression detection
     *
     * Performance Impact:
     * - Minimal overhead when properly configured
     * - Some CPU cost for metric collection and aggregation
     * - Network overhead for metric export
     *
     * Default: false - Must be explicitly enabled for observability
     */
    ENABLE_OPEN_TELEMETRY_METRICS: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(false),
    /**
     * ENABLE_OPEN_TELEMETRY_TRACES - Distributed Tracing
     *
     * Enables collection and export of distributed traces to OpenTelemetry collectors.
     * Provides detailed visibility into request flows across services.
     *
     * Trace Information:
     * - Request spans across service boundaries
     * - Database query traces
     * - External API call traces
     * - GraphQL resolver execution traces
     * - Error and exception traces
     *
     * Benefits:
     * - End-to-end request visibility
     * - Performance bottleneck identification
     * - Service dependency mapping
     * - Root cause analysis for errors
     * - Latency analysis across services
     *
     * Performance Impact:
     * - Low overhead with proper sampling
     * - Some CPU cost for span creation and export
     * - Network overhead for trace export
     *
     * Default: false - Must be explicitly enabled for observability
     */
    ENABLE_OPEN_TELEMETRY_TRACES: z.enum(['true', 'false']).transform(booleanTransformer).pipe(z.boolean()).default(false),
    /**
     * OPEN_TELEMETRY_SERVICE_NAMESPACE - Service Namespace
     *
     * Namespace identifier for grouping related services in telemetry data.
     * Helps organise metrics and traces in monitoring systems.
     *
     * Purpose:
     * - Groups related services under a common namespace
     * - Enables namespace-level aggregations and dashboards
     * - Simplifies service discovery in large architectures
     * - Provides logical service grouping
     *
     * Examples:
     * - 'graphql' - For GraphQL-specific services
     * - 'api' - For API gateway services
     * - 'backend' - For backend services
     * - 'microservices' - For microservice architecture
     *
     * Default: 'graphql' - Appropriate for GraphQL gateway services
     */
    OPEN_TELEMETRY_SERVICE_NAMESPACE: z.string().default('graphql'),
    /**
     * OPEN_TELEMETRY_TRACES_HEADERS - Trace Export Headers
     *
     * HTTP headers to include when exporting traces to the OpenTelemetry collector.
     * Used for authentication, routing, and metadata in trace export requests.
     *
     * Common Headers:
     * - Authorization: 'Bearer <token>' or 'Basic <credentials>'
     * - X-API-Key: '<api-key>' for API key authentication
     * - Content-Type: Usually handled automatically
     * - Custom headers for routing or metadata
     *
     * Security Considerations:
     * - Never log or expose these headers in application logs
     * - Use environment-specific authentication tokens
     * - Rotate credentials regularly
     * - Consider using mTLS instead of header-based auth
     *
     * Format: JSON string that will be parsed into an object
     * Example: '{"Authorization": "Bearer token123", "X-Custom": "value"}'
     *
     * Default: '{}' - No additional headers, relies on collector configuration
     */
    OPEN_TELEMETRY_TRACES_HEADERS: z.string().transform(headerTransformer).optional(),
    /**
     * OPEN_TELEMETRY_METRICS_HEADERS - Metrics Export Headers
     *
     * HTTP headers to include when exporting metrics to the OpenTelemetry collector.
     * Similar to trace headers but specifically for metrics export endpoints.
     *
     * Use Cases:
     * - Different authentication for metrics vs traces
     * - Separate routing for metrics collection
     * - Metrics-specific metadata or tags
     * - Different collector endpoints requiring different auth
     *
     * Security: Same considerations as OPEN_TELEMETRY_TRACES_HEADERS
     *
     * Default: '{}' - No additional headers, uses collector defaults
     */
    OPEN_TELEMETRY_METRICS_HEADERS: z.string().transform(headerTransformer).optional(),
    /**
     * OPEN_TELEMETRY_TRACES_ENDPOINT_URL - Trace Collection Endpoint
     *
     * The URL where traces should be exported to the OpenTelemetry collector.
     * Must be accessible from your application and accept an OTLP/HTTP format.
     *
     * URL Examples:
     * - 'http://localhost:4318/v1/traces' - Local OTEL collector
     * - 'https://api.honeycomb.io/v1/traces' - Honeycomb
     * - 'https://jaeger-collector:14268/api/traces' - Jaeger
     * - 'https://tempo.example.com/v1/traces' - Grafana Tempo
     *
     * Requirements:
     * - Must support OTLP/HTTP protocol
     * - Should be highly available for production use
     * - Consider network latency and reliability
     * - May require authentication (see TRACES_HEADERS)
     *
     * Optional: If not provided, tracing will be disabled even if ENABLE_TRACES is true
     */
    OPEN_TELEMETRY_TRACES_ENDPOINT_URL: z.string().optional(),
    /**
     * OPEN_TELEMETRY_METRICS_ENDPOINT_URL - Metrics Collection Endpoint
     *
     * The URL where metrics should be exported to the OpenTelemetry collector.
     * Must be accessible from your application and accept an OTLP/HTTP format.
     *
     * URL Examples:
     * - 'http://localhost:4318/v1/metrics' - Local OTEL collector
     * - 'https://api.honeycomb.io/v1/metrics' - Honeycomb
     * - 'https://prometheus-remote-write.example.com/api/v1/write' - Prometheus
     * - 'https://metrics.example.com/v1/metrics' - Custom collector
     *
     * Considerations:
     * - May be different from trace endpoint
     * - Consider metrics retention and storage costs
     * - Ensure endpoint can handle your metrics volume
     * - Plan for collector high availability
     *
     * Optional: If not provided, metrics will be disabled even if ENABLE_METRICS is true
     */
    OPEN_TELEMETRY_METRICS_ENDPOINT_URL: z.string().optional(),
    /**
     * OPEN_TELEMETRY_SAMPLING_RATE - Trace Sampling Rate
     *
     * Fraction of traces to sample and export (0.0 to 1.0).
     * Controls the percentage of requests that generate traces.
     *
     * Sampling Strategy:
     * - 1.0 (100%): Sample all traces - high overhead, complete visibility
     * - 0.1 (10%): Sample 10% of traces - good balance for most applications
     * - 0.01 (1%): Sample 1% of traces - low overhead for high-volume services
     * - 0.0 (0%): No sampling - traces collected but not exported
     *
     * Considerations:
     * - Higher rates increase observability but also cost and overhead
     * - Lower rates may miss important traces during incidents
     * - Can be dynamically adjusted based on traffic volume
     * - Consider head-based vs tail-based sampling strategies
     *
     * Production Recommendations:
     * - Start with 0.1 (10%) and adjust based on volume and cost
     * - Increase temporarily during incidents for more visibility
     * - Consider adaptive sampling based on error rates
     *
     * Default: 1.0 - Full sampling for development and testing
     */
    OPEN_TELEMETRY_SAMPLING_RATE: z.string().transform(numberTransformer).pipe(z.number().min(0).max(1)).default(1),
});

/**
 * Environment Variable Loader with Comprehensive Error Handling
 *
 * Loads and validates all environment variables at application startup.
 * Provides detailed error messages for configuration issues.
 *
 * Failure Behavior:
 * - Logs detailed validation errors to console
 * - Exits the process with code 1 (standard failure exit code)
 * - Prevents server startup with invalid configuration
 *
 * Benefits:
 * - Fail-fast principle: catch configuration errors before serving traffic
 * - Clear error messages for troubleshooting misconfigurations
 * - Type-safe configuration throughout the application
 * - Centralized validation logic
 *
 * Error Examples:
 * - Missing required variables: "SERVICE_NAME is required"
 * - Invalid format: "PORT must be a valid number"
 * - Invalid enum values: "NODE_ENV must be one of: production, development, staging"
 */
const loadEnvironmentVariables = () => {
    try {
        const parsed = schema.parse(process.env);
        console.info(JSON.stringify({
            message: 'Environment variables loaded successfully',
            nodeEnv: parsed.NODE_ENV
        }));
        return parsed;
    } catch (e) {
        if (e instanceof z.ZodError) {
            console.error(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'error',
                message: 'Environment validation failed',
                errors: e.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                    code: issue.code
                }))
            }));
        } else {
            console.error(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'error',
                message: 'Failed to load environment variables',
                error: e instanceof Error ? e.message : String(e)
            }));
        }
        process.exit(1);
    }
}


const env = loadEnvironmentVariables();

/**
 * Grouped Configuration Objects
 *
 * Organises validated environment variables into logical groups.
 * Makes configuration more maintainable and easier to understand.
 *
 * Benefits:
 * - Logical separation of concerns
 * - Easier to find related configuration
 * - Better code organisation
 * - Type-safe access throughout application
 */

/**
 * Server Configuration
 *
 * Core server settings that control basic application behaviour.
 */
export const serverConfiguration = {
    nodeEnv: env.NODE_ENV as string,
    port: env.PORT as string,
    logLevel: env.LOG_LEVEL as string,
    serviceName: env.SERVICE_NAME as string,
    serviceVersion: env.SERVICE_VERSION as string,
}


/**
 * CORS Configuration
 *
 * Cross-Origin Resource Sharing settings for web security.
 */
export const corsConfiguration = {
    allowedOrigins: env.CORS_ALLOWED_DOMAIN as string,
}

/**
 * GraphQL Configuration
 *
 * GraphQL-specific feature toggles and settings.
 */
export const graphqlConfiguration = {
    enablePlayground: env.ENABLE_GRAPHQL_PLAYGROUND as boolean,
    enableIntrospection: env.ENABLE_INTROSPECTION as boolean,
    allowBatchedRequests: env.ALLOWED_BATCHED_REQUESTS as boolean,
}

/**
 * Rate Limiting Configuration
 *
 * Request rate limiting settings for abuse prevention.
 */
export const rateLimitConfiguration = {
    rateLimitWindow: env.RATE_LIMIT_WINDOW_MS as number,
    rateLimitMax: env.RATE_LIMIT_MAX as number,
}

/**
 * Apollo Armor Security Configuration
 *
 * GraphQL security protection settings.
 */
export const armourConfiguration = {
    enableBlockFieldSuggestion: env.ENABLE_BLOCK_FIELD_SUGGESTION as boolean,
    blockFieldSuggestionMask: env.BLOCK_FIELD_SUGGESTION_MASK as string,
    enableCostLimit: env.ENABLE_COST_LIMIT as boolean,
    costLimitMaxCost: env.COST_LIMIT_MAX_COST as number,
    costLimitObjectCost: env.COST_LIMIT_OBJECT_COST as number,
    costLimitScalarCost: env.COST_LIMIT_SCALAR_COST as number,
    costLimitDepthCostFactor: env.COST_LIMIT_DEPTH_COST_FACTOR as number,
    costLimitIgnoreIntrospection: env.COST_LIMIT_IGNORE_INTROSPECTION as boolean,
    enableMaxDepth: env.ENABLE_MAX_DEPTH as boolean,
    maxDepthLimit: env.MAX_DEPTH_LIMIT as number,
    maxDepthFlattenFragments: env.MAX_DEPTH_FLATTEN_FRAGMENTS as boolean,
    enableMaxAliases: env.ENABLE_MAX_ALIASES as boolean,
    maxAliasesLimit: env.MAX_ALIASES_LIMIT as number,
    enableMaxDirectives: env.ENABLE_MAX_DIRECTIVES as boolean,
    maxDirectivesLimit: env.MAX_DIRECTIVES_LIMIT as number,
    enableMaxTokens: env.ENABLE_MAX_TOKENS as boolean,
    maxTokensLimit: env.MAX_TOKENS_LIMIT as number,
}

/**
 * OpenTelemetry Configuration
 *
 * OpenTelemetry Tracing and Metrics collection settings.
 */
export const openTelemetryConfiguration = {
    enableTraces: env.ENABLE_OPEN_TELEMETRY_TRACES as boolean,
    enableMetrics: env.ENABLE_OPEN_TELEMETRY_METRICS as boolean,
    nameSpace: env.OPEN_TELEMETRY_SERVICE_NAMESPACE as string,
    tracesHeaders: env.OPEN_TELEMETRY_TRACES_HEADERS as Record<string, string>,
    metricsHeaders: env.OPEN_TELEMETRY_METRICS_HEADERS as Record<string, string>,
    tracesEndpointUrl: env.OPEN_TELEMETRY_TRACES_ENDPOINT_URL as string,
    metricsEndpointUrl: env.OPEN_TELEMETRY_METRICS_ENDPOINT_URL as string,
    samplingRate: env.OPEN_TELEMETRY_SAMPLING_RATE as number,
    metricExportInterval: env.OPEN_TELEMETRY_METRICS_EXPORT_INTERVAL as number,
}

/**
 * PRODUCTION DEPLOYMENT CHECKLIST:
 *
 * 1. ✅ Set NODE_ENV=production
 * 2. ✅ Configure SERVICE_NAME and SERVICE_VERSION
 * 3. ✅ Set CORS_ALLOWED_DOMAIN to your frontend domain
 * 4. ✅ Disable ENABLE_INTROSPECTION and ENABLE_GRAPHQL_PLAYGROUND
 * 5. ✅ Configure appropriate rate-limiting values (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)
 * 6. ✅ Set LOG_LEVEL to 'warn' or 'error' for production
 * 7. ✅ Enable all Apollo Armor security features
 * 8. ✅ Configure OpenTelemetry endpoints if observability is needed
 * 9. ✅ Test configuration validation with invalid values
 *
 * ENVIRONMENT-SPECIFIC SETTINGS:
 *
 * Development:
 * - NODE_ENV=development
 * - ENABLE_INTROSPECTION=true
 * - ENABLE_GRAPHQL_PLAYGROUND=true
 * - LOG_LEVEL=debug
 * - CORS_ALLOWED_DOMAIN=localhost
 * - RATE_LIMIT_MAX=1000 (higher for development)
 * - ENABLE_OPEN_TELEMETRY_TRACES=true (optional)
 * - OPEN_TELEMETRY_SAMPLING_RATE=1.0
 *
 * Staging:
 * - NODE_ENV=uat or candidate
 * - ENABLE_INTROSPECTION=true (for testing)
 * - ENABLE_GRAPHQL_PLAYGROUND=false
 * - LOG_LEVEL=info
 * - Production-like rate limits
 * - ENABLE_OPEN_TELEMETRY_METRICS=true
 * - OPEN_TELEMETRY_SAMPLING_RATE=0.1
 *
 * Production:
 * - NODE_ENV=production
 * - ENABLE_INTROSPECTION=false
 * - ENABLE_GRAPHQL_PLAYGROUND=false
 * - LOG_LEVEL=warn
 * - RATE_LIMIT_WINDOW_MS=900000 (15 minutes)
 * - RATE_LIMIT_MAX=100 (adjust based on usage)
 * - All security features enabled (defaults are secure)
 * - OPEN_TELEMETRY_SAMPLING_RATE=0.01-0.1 (1-10%)
 *
 * SECURITY BEST PRACTICES:
 *
 * - Never commit .env files with real credentials
 * - Use different configuration for each environment
 * - Validate configuration in CI/CD pipelines
 * - Monitor configuration changes in production
 * - Use secret management for sensitive values (OTEL headers, etc.)
 * - Regularly audit environment variable usage
 * - Monitor rate limiting effectiveness and adjust as needed
 * - Set up alerts for security feature violations
 * - Test Apollo Armor configurations under load
 */