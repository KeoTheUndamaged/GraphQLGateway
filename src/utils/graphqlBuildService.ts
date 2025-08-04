import {RemoteGraphQLDataSource, ServiceEndpointDefinition} from '@apollo/gateway';
import { context, propagation } from '@opentelemetry/api';
import {getServiceToken, serverConfiguration} from '../managers/environmentManager';
import {createLogger} from '../managers/loggerManager';
import { CircuitBreakerDataSource } from './circuitBreakerDataSource';

/**
 * Apollo Gateway Service Builder with Circuit Breaker Integration
 *
 * This factory function creates a circuit breaker enhanced `RemoteGraphQLDataSource`
 * instance for each subgraph service. It preserves all existing functionality while
 * adding resilience through circuit breaker pattern.
 *
 * Features:
 * - Circuit breaker protection for subgraph failures
 * - OpenTelemetry context propagation
 * - Authentication token forwarding
 * - Service-to-service authentication
 * - Custom header injection
 *
 * @param {ServiceEndpointDefinition} service - The definition of the subgraph service.
 * @returns {CircuitBreakerDataSource} A circuit breaker enhanced data source.
 */
export const buildService = ({ url, name }: ServiceEndpointDefinition): RemoteGraphQLDataSource => {
    const logger = createLogger(serverConfiguration.logLevel);

    // Guard clause to ensure a valid URL is always provided.
    if (!url) {
        throw new Error(`No URL provided for service: ${name}`);
    }

    // Create the circuit breaker enhanced data source
    const dataSource = new CircuitBreakerDataSource({ url, name });

    // Configure the existing willSendRequest functionality
    // This preserves all the critical authentication and observability features
    const originalWillSendRequest = dataSource.willSendRequest?.bind(dataSource);

    dataSource.willSendRequest = function({ request, context: apolloContext }: { request: any; context: any; }): void {
        // Call original willSendRequest if it exists (from parent class)
        if (originalWillSendRequest) {
            //@ts-ignore
            originalWillSendRequest({ request, context: apolloContext });
        }

        // Safety check: Ensure the request object has an HTTP property.
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
         * Preserves the existing OpenTelemetry functionality
         */
        try {
            const activeContext = context.active();
            propagation.inject(activeContext, request.http.headers, {
                set: (carrier, key, value) => {
                    carrier.set(key, value);
                },
            });
        } catch (error) {
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
         * Preserves the existing service token functionality
         */
        const serviceToken = getServiceToken(name);
        if (serviceToken) {
            request.http.headers.set('X-Service-Token', serviceToken);
        }

        /**
         * Forwarding Client Authorization
         *
         * Preserves the existing client token forwarding
         */
        if (apolloContext.token) {
            request.http.headers.set('Authorization', apolloContext.token);
        }

        /**
         * Adding Common Request Headers
         *
         * Preserves the existing service identification headers
         */
        request.http.headers.set('X-Service-Name', serverConfiguration.serviceName);
        request.http.headers.set('X-Request-ID', Math.random().toString(36).substring(7));
    };

    return dataSource;
};