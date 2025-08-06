import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import Keycloak from 'keycloak-connect';
import { createLogger } from '../managers/loggerManager';
import { serverConfiguration, keycloakConfiguration } from '../managers/environmentManager';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const logger = createLogger(serverConfiguration.logLevel);

const memoryStore = new session.MemoryStore();

const keycloakConfig = {
    realm: keycloakConfiguration.realm,
    'auth-server-url': keycloakConfiguration.url,
    'ssl-required': keycloakConfiguration.sslRequired,
    resource: keycloakConfiguration.clientId,
    'public-client': keycloakConfiguration.publicClient,
    'confidential-port': keycloakConfiguration.confidentialPort,
    'bearer-only': true,
}

export const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

export const sessionConfig = session({
    secret: keycloakConfiguration.sessionSecret,
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
    cookie: {
        secure: serverConfiguration.nodeEnv === 'production',
        maxAge: 24 * 60 * 60 * 1000,
    }
});

// JWKS client for token verification
const jwksClientInstance = jwksClient({
    jwksUri: `${keycloakConfiguration.url}/realms/${keycloakConfiguration.realm}/protocol/openid-connect/certs`
});

const getKey = (header: any, callback: any) => {
    jwksClientInstance.getSigningKey(header.kid, (err, key) => {
        if (err) {
            return callback(err);
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
    });
};

/**
 * Creates a GraphQL-style error response for authentication failures
 */
const createGraphQLAuthError = (message: string, code: string = 'UNAUTHENTICATED') => {
    return {
        errors: [
            {
                message,
                extensions: {
                    code,
                    timestamp: new Date().toISOString()
                }
            }
        ],
        data: null
    };
};

export const keycloakAuth = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Handle unauthenticated requests
    if (keycloakConfiguration.allowUnauthenticated &&
        (!authHeader || !authHeader.startsWith('Bearer '))) {
        logger.debug('No authentication token provided, proceeding as guest');
        (req as any).user = { isGuest: true };
        return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const errorResponse = createGraphQLAuthError(
            'Authentication required. Bearer token must be provided.',
            'UNAUTHENTICATED'
        );

        logger.warn('Authentication required but no bearer token provided', {
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        return res.status(401).json(errorResponse);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        // Verify the JWT token with multiple acceptable audiences
        const decoded = await new Promise<any>((resolve, reject) => {
            jwt.verify(token, getKey, {
                issuer: `${keycloakConfiguration.url}/realms/${keycloakConfiguration.realm}`,
                // Accept either the client ID or 'account' as valid audience
                audience: [keycloakConfiguration.clientId, 'account'],
                algorithms: ['RS256']
            }, (err, decoded) => {
                if (err) {
                    reject(err);
                } else {
                    // Additional validation: ensure azp (authorized party) matches our client ID
                    if (decoded && typeof decoded === 'object' && 'azp' in decoded) {
                        if (decoded.azp !== keycloakConfiguration.clientId) {
                            reject(new Error(`Token authorized party (azp) ${decoded.azp} does not match expected client ${keycloakConfiguration.clientId}`));
                            return;
                        }
                    }
                    resolve(decoded);
                }
            });
        });

        logger.debug('Token verification successful', {
            user: decoded.preferred_username || decoded.sub,
            client: decoded.azp,
            audience: decoded.aud
        });

        (req as any).user = {
            isGuest: false,
            keycloakUser: decoded
        };

        next();
    } catch (error) {
        if (keycloakConfiguration.allowUnauthenticated) {
            logger.debug('Token verification failed, proceeding as guest', {
                error: error instanceof Error ? error.message : String(error)
            });
            (req as any).user = { isGuest: true };
            return next();
        }

        const errorResponse = createGraphQLAuthError(
            'Invalid or expired authentication token.',
            'UNAUTHENTICATED'
        );

        logger.warn('Token verification failed', {
            error: error instanceof Error ? error.message : String(error),
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        return res.status(401).json(errorResponse);
    }
};