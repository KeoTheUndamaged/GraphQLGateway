import {RemoteGraphQLDataSource, ServiceEndpointDefinition} from '@apollo/gateway';
import {getServiceToken, serverConfiguration} from '../managers/environmentManager';

export const buildService = ({ url, name }: ServiceEndpointDefinition) => {
    // Handle the case where the url might be undefined
    if (!url) {
        throw new Error(`No URL provided for service: ${name}`);
    }
    return new RemoteGraphQLDataSource({
        url,
        willSendRequest({ request, context }): void {
            // Handle the case where request.http might be undefined
            if (!request.http) {
                request.http = {
                    method: 'POST',
                    url: url,
                    headers: new Headers(),
                };
            }

            // Service-specific headers from the environment
            const serviceToken = getServiceToken(name);
            if (serviceToken) {
                request.http.headers.set('X-Service-Token', serviceToken);
            }

            // Forward authorisation from a client
            if (context.token) {
                request.http.headers.set('Authorization', context.token);
            }

            // Add common headers
            request.http.headers.set('X-Service-Name', serverConfiguration.serviceName);
            request.http.headers.set('X-Request-ID', Math.random().toString(36).substring(7));
        },
    });
}
