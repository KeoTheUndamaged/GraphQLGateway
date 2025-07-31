/**
 * Apollo Armor Security Configuration
 *
 * Apollo Armor provides comprehensive GraphQL security protection against common attacks:
 * - Query depth attacks (deeply nested queries)
 * - Query complexity/cost attacks (expensive operations)
 * - Field suggestion attacks (schema information disclosure)
 * - Alias flooding attacks (resource exhaustion)
 * - Directive flooding attacks (parser exhaustion)
 * - Token flooding attacks (memory exhaustion)
 *
 * IMPORTANT: These limits should be tuned based on your schema complexity and expected usage patterns.
 * Monitor logs for rejected queries and adjust limits accordingly.
 *
 * Security vs Usability Trade-offs:
 * - Stricter limits = better security but may block legitimate complex queries
 * - Looser limits = better usability but higher attack surface
 */

import {ValidationContext} from 'graphql/validation';
import {GraphQLError} from 'graphql/error';

import {createLogger} from '../utils/logger';
import {apolloArmorConfig, serverConfig} from '../utils/environmentVariables';

const logger = createLogger(serverConfig.logLevel);

/**
 * Centralized rejection logging for security monitoring
 *
 * Logs all Apollo Armor rejections for security analysis and limit tuning.
 * Consider integrating with security monitoring tools in production.
 *
 * @param ctx - GraphQL validation context (may be null)
 * @param error - The GraphQL error containing rejection details
 */
const logRejection: (ctx: (ValidationContext | null), error: GraphQLError) => void = (ctx: ValidationContext | null, error: GraphQLError): void => {
    logger.warn('Query rejected', {error: error.message, stack: error.stack, context: ctx})
}

const apolloArmorOptions = {
    /**
     * Block Field Suggestions
     *
     * Prevents attackers from discovering schema structure through field suggestion errors.
     * When a field doesn't exist, GraphQL normally suggests similar field names.
     *
     * Security Impact: HIGH - Prevents schema enumeration attacks
     * Performance Impact: NONE
     *
     * Recommendation: ALWAYS ENABLE in production
     */
    blockFieldSuggestion: {
        enabled: apolloArmorConfig.enableBlockFieldSuggestion,
        mask: '<[REDACTED]>',
    },

    /**
     * Query Cost Analysis and Limiting
     *
     * Analyzes query complexity and rejects expensive operations before execution.
     * Prevents resource exhaustion from computationally expensive queries.
     *
     * Cost Calculation:
     * - Each object field = objectCost (default: 2)
     * - Each scalar field = scalarCost (default: 1)
     * - Each nesting level multiplied by depthCostFactor (default: 1.5)
     *
     * Security Impact: HIGH - Prevents DoS attacks via expensive queries
     * Performance Impact: LOW - Analysis happens during validation, not execution
     *
     * Tuning Guidelines:
     * - Monitor rejected queries to find appropriate maxCost
     * - Start conservative (5000) and increase based on legitimate usage
     * - Consider your database/subgraph performance capabilities
     */
    costLimit: {
        enabled: apolloArmorConfig.enableCostLimit,
        maxCost: 5000, // Maximum allowed query cost
        objectCost: 2, // Cost per object field
        scalarCost: 1, // Cost per scalar field
        depthCostFactor: 1.5, // Multiplier for each nesting level
        ignoreIntrospection: true, // Don't apply cost analysis to introspection queries
        onReject: [logRejection], // Log rejected queries for analysis
        propagateOnRejection: true, // Include rejection details in error response
    },

    /**
     * Query Depth Limiting
     *
     * Prevents deeply nested queries that can cause exponential resource usage.
     * Particularly important for GraphQL schemas with circular references.
     *
     * Example Attack:
     * query { user { posts { author { posts { author { posts { ... } } } } } } }
     *
     * Security Impact: HIGH - Prevents stack overflow and resource exhaustion
     * Performance Impact: NONE - Simple depth counting during validation
     *
     * Tuning Guidelines:
     * - Consider your schema's maximum legitimate nesting-depth
     * - Typical APIs rarely need more than 10-15 levels
     * - Monitor for legitimate queries hitting the limit
     */
    maxDepth: {
        enabled: apolloArmorConfig.enableMaxDepth,
        n: 5, // Maximum query depth allowed
        ignoreIntrospection: true, // Introspection queries can be deep
        flattenFragments: false, // Count fragment depth separately (more accurate)
        onReject: [logRejection], // Log rejected queries for analysis
        propagateOnRejection: true, // Include rejection details in error response
    },

    /**
     * Query Alias Limiting
     *
     * Prevents alias flooding attacks where attackers use many aliases
     * to request the same expensive field multiple times.
     *
     * Example Attack:
     * query {
     *   user1: user(id: 1) { posts }
     *   user2: user(id: 1) { posts }
     *   user3: user(id: 1) { posts }
     *   ... (hundreds of aliases)
     * }
     *
     * Security Impact: MEDIUM - Prevents resource multiplication attacks
     * Performance Impact: NONE - Simple alias counting
     *
     * Tuning Guidelines:
     * - Consider legitimate use cases for aliases (A/B testing, etc.)
     * - 15-20 aliases typically sufficient for most applications
     * - Monitor for false positives in complex UIs
     */
    maxAliases: {
        enabled: apolloArmorConfig.enableMaxAliases,
        n: 15, // Maximum aliases per query
        onReject: [logRejection], // Log rejected queries for analysis
        propagateOnRejection: true, // Include rejection details in error response
    },

    /**
     * Directive Count Limiting
     *
     * Prevents directive flooding attacks that can overwhelm the GraphQL parser.
     * Directives are processed during query parsing and can be computationally expensive.
     *
     * Example Attack:
     * query {
     *   user @directive1 @directive2 @directive3 ... @directive100 {
     *     name @directive1 @directive2 ...
     *   }
     * }
     *
     * Security Impact: MEDIUM - Prevents parser DoS attacks
     * Performance Impact: NONE - Simple directive counting
     *
     * Tuning Guidelines:
     * - Most queries use very few directives
     * - 50 directives is generous for legitimate use cases
     * - Monitor for applications using many custom directives
     */
    maxDirectives: {
        enabled: apolloArmorConfig.enableMaxDirectives,
        n: 50, // Maximum directives per query
        onReject: [logRejection], // Log rejected queries for analysis
        propagateOnRejection: true, // Include rejection details in error response
    },

    /**
     * Query Token Limiting
     *
     * Prevents extremely large queries that consume excessive memory during parsing.
     * Tokens include keywords, field names, variables, literals, punctuation, etc.
     *
     * Example Attack: Sending queries with thousands of field selections or huge variable lists.
     *
     * Security Impact: HIGH - Prevents memory exhaustion attacks
     * Performance Impact: NONE - Token counting during parsing
     *
     * Tuning Guidelines:
     * - 1000 tokens accommodates most legitimate queries
     * - Code generation tools may create larger queries
     * - Monitor for auto-generated queries hitting the limit
     * - Consider query complexity over raw size
     */
    maxTokens: {
        enabled: apolloArmorConfig.enableMaxTokens,
        n: 1000, // Maximum tokens per query
        onReject: [logRejection], // Log rejected queries for analysis
        propagateOnRejection: true, // Include rejection details in error response
    }
};

export default apolloArmorOptions;

/**
 * PRODUCTION DEPLOYMENT CHECKLIST:
 *
 * 1. ✅ Enable all armour features in production
 * 2. ✅ Set up monitoring for rejected queries
 * 3. ✅ Tune limits based on your schema and usage patterns
 * 4. ✅ Test complex legitimate queries against these limits
 * 5. ✅ Consider implementing a query allowlisting for critical operations
 * 6. ✅ Monitor performance impact of cost analysis
 * 7. ✅ Document approved query patterns for your team
 *
 * MONITORING RECOMMENDATIONS:
 *
 * - Alert on high rates of armour rejections (potential attack)
 * - Track which limits are hit most frequently
 * - Monitor for false positives affecting legitimate users
 * - Consider implementing progressive rate limiting for repeated violations
 *
 * PERFORMANCE CONSIDERATIONS:
 *
 * - Cost analysis adds ~1-5 ms per query validation
 * - Other limits have negligible performance impact
 * - Consider caching cost analysis for repeated queries
 * - Monitor memory usage with large schemas
 */
