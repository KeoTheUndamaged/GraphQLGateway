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

import {z} from 'zod';

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

const booleanTransformer = (val: any): boolean => val.toLowerCase() === 'true'
/**
 * Number String Transformer
 *
 * Converts string environment variables to numbers with validation.
 * Includes error handling for invalid numeric values.
 */
const numberTransformer = (val: any): number => parseInt(val, 10)

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
const schema = z.object({
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
    NODE_ENV: z.enum(['production', 'development', 'staging', 'uat', 'test']).default('production'),
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
    PORT: z.string().default('4000'),
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
    LOG_LEVEL: z.string().default('warn'),

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
    SERVICE_NAME: z.string().min(1, "SERVICE_NAME is required for service identification"),
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
    SERVICE_VERSION: z.string().min(1, "SERVICE_VERSION is required for deployment tracking"),

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
    CORS_ALLOWED_DOMAIN: z.string().min(1, "CORS_ALLOWED_DOMAIN is required for web security"),

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
    ALLOW_BATCHED_REQUESTS: z.string().transform(booleanTransformer).pipe(z.boolean()).default(false),
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
    ENABLE_INTROSPECTION: z.string().transform(booleanTransformer).pipe(z.boolean()).default(false),

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
    ENABLE_GRAPHQL_PLAYGROUND: z.string().transform(booleanTransformer).pipe(z.boolean()).default(false),

    /**
     * Apollo Armor Security Configuration
     *
     * Apollo Armor provides comprehensive GraphQL security protection.
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
    ENABLE_BLOCK_FIELD_SUGGESTION: z.string().transform(booleanTransformer).pipe(z.boolean()).default(true),

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
    ENABLE_COST_LIMIT: z.string().transform(booleanTransformer).pipe(z.boolean()).default(true),

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
    ENABLE_MAX_DEPTH: z.string().transform(booleanTransformer).pipe(z.boolean()).default(true),

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
    ENABLE_MAX_ALIASES: z.string().transform(booleanTransformer).pipe(z.boolean()).default(true),

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
    ENABLE_MAX_DIRECTIVES: z.string().transform(booleanTransformer).pipe(z.boolean()).default(true),

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
    ENABLE_MAX_TOKENS: z.string().transform(booleanTransformer).pipe(z.boolean()).default(true),

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

    /**
     * OpenTelemetry Trace Export Endpoint
     *
     * OTLP (OpenTelemetry Protocol) HTTP endpoint for exporting distributed tracing data.
     * This endpoint receives trace spans that represent individual operations and requests
     * flowing through your federated GraphQL gateway and downstream services.
     *
     * Common Values:
     * - Jaeger: "http://jaeger-collector:14268/api/traces"
     * - DataDog: "https://trace.agent.datadoghq.com/v0.4/traces"
     * - New Relic: "https://otlp.nr-data.net/v1/traces"
     * - Local Collector: "http://localhost:4318/v1/traces"
     * - Grafana Cloud: "https://tempo-<region>.grafana.net/otlp/v1/traces"
     *
     * Security Considerations:
     * - Use HTTPS in production to encrypt trace data in transit
     * - Traces may contain sensitive request/response data
     * - Consider authentication headers for commercial services
     * - Optional to allow graceful degradation if observability is unavailable
     */
    OTEL_EXPORTER_TRACE_OTLP_ENDPOINT: z.string().optional(),
    /**
     * OpenTelemetry Metrics Export Endpoint
     *
     * OTLP HTTP endpoint for exporting application and system metrics data.
     * Metrics provide quantitative measurements of your service performance,
     * resource utilization, and business KPIs over time.
     *
     * Metrics Types Exported:
     * - Counter: Request count, error count, cache hits/misses
     * - Histogram: Request duration, query complexity, response size
     * - Gauge: Current memory usage, active connections, queue depth
     * - Summary: Percentile distributions of latency metrics
     *
     * Common Values:
     * - Prometheus: "http://prometheus-pushgateway:9091/metrics/job/graphql-gateway"
     * - DataDog: "https://api.datadoghq.com/api/v2/series"
     * - New Relic: "https://otlp.nr-data.net/v1/metrics"
     * - Local Collector: "http://localhost:4318/v1/metrics"
     * - Grafana Cloud: "https://prometheus-<region>.grafana.net/api/prom/push"
     *
     * Performance Impact:
     * - Metrics are aggregated locally before export to reduce network overhead
     * - Export frequency controlled by OTEL_METRICS_EXPORT_INTERVAL
     * - Failed exports are retried with exponential backoff
     */
    OTEL_EXPORTER_METRIC_OTLP_ENDPOINT: z.string().optional(),
    /**
     * OpenTelemetry Metrics Export Interval (milliseconds)
     *
     * Controls how frequently aggregated metrics are exported to the monitoring backend.
     * This is a critical balance between data freshness and system performance.
     *
     * Interval Trade-offs:
     * - Shorter intervals (5-15 s): Near real-time metrics, higher network/CPU overhead
     * - Medium intervals (30-60 s): Good balance for most applications
     * - Longer intervals (2-5 min): Lower overhead, delayed alerting capability
     *
     * Considerations by Environment:
     * - Development: 10-30 seconds for rapid feedback
     * - Staging: 30-60 seconds for integration testing
     * - Production: 30-60 seconds for most applications, 10-15s for critical services
     *
     * Network Impact:
     * - Each export sends all accumulated metrics since last export
     * - Higher frequency = more network requests but smaller payloads
     * - Failed exports are retried, potentially causing metric delays
     *
     * Default: 30000 ms (30 seconds) - industry standard for most applications
     *
     * Validation: Must be a positive number to prevent configuration errors
     * Transform: String to number conversion for environment variable compatibility
     */
    OTEL_METRIC_EXPORT_INTERVAL: z.string().transform(numberTransformer).pipe(z.number().positive()).default(30000),

    /**
     * OpenTelemetry Trace Sampling Rate
     *
     * Controls the percentage of traces that are sampled and exported to reduce
     * performance impact and storage costs in high-traffic production environments.
     *
     * Sampling Strategy:
     * - Head-based sampling: Decision made when trace starts (what this implements)
     * - Probabilistic: Random sampling based on trace ID
     * - Rate-based: Maintains a consistent sample rate regardless of traffic volume
     *
     * Value Guidelines:
     * - 1.0 (100%): Development, staging, low-traffic production (<1000 req/min)
     * - 0.1 (10%): Medium traffic production (1000-10000 req/min)
     * - 0.01 (1%): High traffic production (>10,000 req/min)
     * - 0.001 (0.1%): Very high traffic (>100,000 req/min)
     *
     * Sampling Considerations:
     * - Critical errors should always be traced (error-based sampling)
     * - Important user journeys may need higher sampling rates
     * - Sampling reduces trace volume but may miss rare issues
     * - Consider adaptive sampling based on service health
     *
     * Performance Impact:
     * - Lower sampling reduces CPU overhead of trace processing
     * - Reduces network bandwidth for trace export
     * - Decreases storage costs in tracing backend
     * - May reduce observability into rare edge cases
     *
     * Default: 1.0 (100%) - safe for development, should be tuned for production
     *
     * Validation: Must be a positive number between 0 and 1
     * Transform: String to number conversion for environment variable compatibility
     */
    OTEL_SAMPLING_RATE: z.string().transform(numberTransformer).pipe(z.number().min(0).max(1)).default(1),

    /**
     * Enable/Disable OpenTelemetry Tracing and Metric
     *
     * Master switch to completely enable or disable distributed tracing functionality.
     * Provides a way to quickly disable observability in case of issues without
     * redeploying the application.
     *
     * Use Cases for Disabling:
     * - Emergency production issues caused by tracing overhead
     * - Cost optimisation during low-priority periods
     * - Compliance requirements in certain environments
     * - Development environments where tracing is not needed
     * - A/B testing the impact of observability on performance
     *
     * When Disabled:
     * - No trace spans are created or exported
     * - Zero performance overhead from tracing instrumentation
     * - Metrics export may still be enabled independently
     * - Application continues to function normally
     * - Reduces observability into request flows and performance
     *
     * Production Considerations:
     * - Should typically be enabled in production for incident response
     * - Can be dynamically disabled via configuration management
     * - Consider gradual rollout when re-enabling after issues
     * - Monitor application performance before/after enabling
     *
     * Default: false - Conservative default requiring explicit opt-in
     * This ensures tracing doesn't impact performance unless intentionally enabled
     *
     * Transform: String to boolean conversion supporting common environment variable patterns:
     * - "true", "TRUE", "True" -> true
     * - "false", "FALSE", "False", undefined, "" -> false
     */
    ENABLE_TRACES: z.string().transform(booleanTransformer).pipe(z.boolean()).default(false),
    ENABLE_METRICS: z.string().transform(booleanTransformer).pipe(z.boolean()).default(false),
    /**
     * OpenTelemetry Service Namespace
     * Groups related services for better organisation in monitoring dashboards
     */
    OTEL_SERVICE_NAMESPACE: z.string().default('graphql'),

    /**
     * OpenTelemetry Export Headers
     * Authentication and custom headers for trace/metrics export
     */
    OTEL_EXPORTER_OTLP_TRACE_HEADERS: z.string().transform((val) => {
        try { return JSON.parse(val) } catch { return {} }
    }).default('{}'),
    OTEL_EXPORTER_OTLP_METRIC_HEADERS: z.string().transform((val) => {
        try { return JSON.parse(val) } catch { return {} }
    }).default('{}'),

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
        return schema.parse(process.env);
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error('Invalid environment variables', {error: err.message, stack: err.stack})
            process.exit(1);
        }
        throw err;
    }
}

// Load and validate environment variables at module initialization
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
export const serverConfig = {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    serviceName: env.SERVICE_NAME,
    serviceVersion: env.SERVICE_VERSION,
}

/**
 * CORS Configuration
 *
 * Cross-Origin Resource Sharing settings for web security.
 */
export const corsConfig = {
    corsAllowedDomains: env.CORS_ALLOWED_DOMAIN,
}

/**
 * GraphQL Configuration
 *
 * GraphQL-specific feature toggles and settings.
 */
export const graphqlConfig = {
    enableIntrospection: env.ENABLE_INTROSPECTION,
    enableGraphQLPlayground: env.ENABLE_GRAPHQL_PLAYGROUND,
    allowBatchedRequests: env.ALLOW_BATCHED_REQUESTS
}

/**
 * Rate Limiting Configuration
 *
 * Request rate limiting settings for abuse prevention.
 */
export const rateLimitConfig = {
    rateLimitWindow: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: env.RATE_LIMIT_MAX,
}

/**
 * Apollo Armor Security Configuration
 *
 * GraphQL security protection settings.
 */
export const apolloArmorConfig = {
    enableBlockFieldSuggestion: env.ENABLE_BLOCK_FIELD_SUGGESTION,
    enableCostLimit: env.ENABLE_COST_LIMIT,
    enableMaxDepth: env.ENABLE_MAX_DEPTH,
    enableMaxAliases: env.ENABLE_MAX_ALIASES,
    enableMaxDirectives: env.ENABLE_MAX_DIRECTIVES,
    enableMaxTokens: env.ENABLE_MAX_TOKENS,
}

/**
 * OpenTelemetry Configuration
 *
 * OpenTelemetry Tracing and Metrics collection settings.
 */
export const openTelemetryConfig = {
    openTelemetryTracingEndpoint: env.OTEL_EXPORTER_TRACE_OTLP_ENDPOINT,
    openTelemetryMetricEndpoint: env.OTEL_EXPORTER_METRIC_OTLP_ENDPOINT,
    openTelemetryMetricsExportInterval: env.OTEL_METRIC_EXPORT_INTERVAL,
    openTelemetryServiceNamespace: env.OTEL_SERVICE_NAMESPACE,
    openTelemetryTracingExporterHeaders: env.OTEL_EXPORTER_OTLP_TRACE_HEADERS,
    openTelemetryMetricExporterHeaders: env.OTEL_EXPORTER_OTLP_METRIC_HEADERS,
    samplingRate: env.OTEL_SAMPLING_RATE,
    enableTraces: env.ENABLE_TRACES,
    enableMetrics: env.ENABLE_METRICS,
}

/**
 * PRODUCTION DEPLOYMENT CHECKLIST:
 *
 * 1. ✅ Set NODE_ENV=production
 * 2. ✅ Configure SERVICE_NAME and SERVICE_VERSION
 * 3. ✅ Set CORS_ALLOWED_DOMAIN to your frontend domain
 * 4. ✅ Disable ENABLE_INTROSPECTION and ENABLE_GRAPHQL_PLAYGROUND
 * 5. ✅ Configure appropriate rate-limiting values
 * 6. ✅ Set LOG_LEVEL to 'warn' or 'error' for production
 * 7. ✅ Enable all Apollo Armor security features
 * 8. ✅ Test configuration validation with invalid values
 *
 * ENVIRONMENT-SPECIFIC SETTINGS:
 *
 * Development:
 * - NODE_ENV=development
 * - ENABLE_INTROSPECTION=true
 * - ENABLE_GRAPHQL_PLAYGROUND=true
 * - LOG_LEVEL=debug
 * - CORS_ALLOWED_DOMAIN=localhost
 *
 * Staging:
 * - NODE_ENV=staging
 * - ENABLE_INTROSPECTION=true (for testing)
 * - ENABLE_GRAPHQL_PLAYGROUND=false
 * - LOG_LEVEL=info
 * - Production-like rate limits
 *
 * Production:
 * - NODE_ENV=production
 * - ENABLE_INTROSPECTION=false
 * - ENABLE_GRAPHQL_PLAYGROUND=false
 * - LOG_LEVEL=warn
 * - Strict rate limits
 * - All security features enabled
 *
 * SECURITY BEST PRACTICES:
 *
 * - Never commit .env files with real credentials
 * - Use different configuration for each environment
 * - Validate configuration in CI/CD pipelines
 * - Monitor configuration changes in production
 * - Use secret management for sensitive values
 * - Regularly audit environment variable usage
 */
