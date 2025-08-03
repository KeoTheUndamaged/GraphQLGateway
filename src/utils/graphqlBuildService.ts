import {RemoteGraphQLDataSource, ServiceEndpointDefinition} from '@apollo/gateway';
import { context, propagation } from '@opentelemetry/api';
import {getServiceToken, serverConfiguration} from '../managers/environmentManager';
import {createLogger} from '../managers/loggerManager';

/**
 * Apollo Gateway Service Builder
 *
 * This factory function creates a `RemoteGraphQLDataSource` instance for each subgraph
 * service defined in the Supergraph schema. It is a critical part of the Apollo
 * Federation Gateway, enabling custom behaviour for outgoing requests.
 *
 * It intercepts every outgoing HTTP request from the Gateway to a subgraph, allowing
 * for the injection of headers, authentication tokens, and observability context.
 *
 * @param {ServiceEndpointDefinition} service - The definition of the subgraph service.
 * @returns {RemoteGraphQLDataSource} A configured data source for the service.
 */
export const buildService = ({ url, name }: ServiceEndpointDefinition): RemoteGraphQLDataSource => {
    const logger = createLogger(serverConfiguration.logLevel);

    // Guard clause to ensure a valid URL is always provided.
    // This prevents runtime errors if the Supergraph schema is misconfigured.
    if (!url) {
        throw new Error(`No URL provided for service: ${name}`);
    }

    return new RemoteGraphQLDataSource({
        url,
        /**
         * Outgoing Request Interception Hook
         *
         * This hook is executed just before the Apollo Gateway sends an HTTP request
         * to a downstream subgraph service. It's the ideal place to modify headers
         * and inject request-scoped data.
         *
         * Responsibilities:
         * - Manual OpenTelemetry Context Injection
         * - Authentication and Authorisation Token Forwarding
         * - Service-to-Service Authentication (e.g. X-Service-Token)
         * - Custom Header Injection (e.g. X-Request-ID)
         *
         * @param {object} args - The request details and Apollo context.
         * @param {object} args.request - The outgoing request objects to the subgraph.
         * @param {object} args.context - The Apollo context from the client's request.
         */
        willSendRequest({ request, context: apolloContext }: { request: any; context: any; }): void {
            // Safety check: Ensure the request object has an HTTP property.
            // This handles potential edge cases where the `http` object might not be present.
            if (!request.http) {
                request.http = {
                    method: 'POST',
                    url: url,
                    headers: new Headers(),
                };
            }

            /**
             * OpenTelemetry Context Propagation (Manual Injection)
             *
             * This block manually injects the OpenTelemetry trace context into the
             * outgoing request headers. This is critical for connecting spans across
             * distributed services, as automatic instrumentation may not always
             * correctly handle the specific HTTP client used by Apollo Gateway.
             *
             * How it works:
             * - It retrieves the active span from the current execution context.
             * - It uses the `propagation` API to serialise this context into
             * W3C Trace Context headers (`traceparent`, `tracestate`).
             * - These headers are then added to the outgoing request.
             *
             * Defensive Programming:
             * - A `try...catch` block is used to prevent the application from crashing
             * if the OpenTelemetry API fails for any reason, ensuring service
             * resilience even if observability is compromised.
             */
            try {
                // Get the active context for the current trace from the global API
                const activeContext = context.active();

                // Inject the trace context into the outgoing headers
                // This adds the 'traceparent' and 'tracestate' headers.
                propagation.inject(activeContext, request.http.headers, {
                    set: (carrier, key, value) => {
                        carrier.set(key, value);
                    },
                });
            } catch (error) {
                // Log the error but do not re-throw, allowing the request to continue.
                logger.error('An error occurred during OpenTelemetry context injection.', {
                    error: {
                        message: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : 'No stack trace available.',
                    }
                });
            }

            /**
             * Service-to-Service Authentication
             *
             * Adds a unique, service-specific token to the request headers.
             * This is used by the downstream subgraph service to authenticate
             * that the request originated from a trusted source (the Gateway).
             */
            const serviceToken = getServiceToken(name);
            if (serviceToken) {
                request.http.headers.set('X-Service-Token', serviceToken);
            }

            /**
             * Forwarding Client Authorisation
             *
             * Forwards the `Authorization` header from the client's original request
             * to the subgraph. This is essential for propagating the user's identity
             * and permissions for downstream authentication and authorisation.
             */
            if (apolloContext.token) {
                request.http.headers.set('Authorization', apolloContext.token);
            }

            /**
             * Adding Common Request Headers
             *
             * Injects additional headers for service identification and request tracking.
             *
             * - `X-Service-Name`: Identifies the originating service (the Gateway).
             * - `X-Request-ID`: Provides a unique, traceable ID for the entire request
             * lifecycle, useful for logging and debugging.
             */
            request.http.headers.set('X-Service-Name', serverConfiguration.serviceName);
            request.http.headers.set('X-Request-ID', Math.random().toString(36).substring(7));
        },
    });
}