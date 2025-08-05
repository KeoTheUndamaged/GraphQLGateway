// Mock the environment manager before importing anything
jest.mock('../../../managers/environmentManager', () => ({
    serverConfiguration: {
        nodeEnv: 'test',
        logLevel: 'error'
    },
    corsConfiguration: {
        allowedOrigins: 'example.com,test.com'
    }
}));

// Mock the logger manager
jest.mock('../../../managers/loggerManager', () => ({
    createLogger: jest.fn(() => ({
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));

describe('CORS Options Configuration', () => {
    let corsOptions: any;

    beforeAll(() => {
        // Clear module cache to ensure fresh imports
        jest.resetModules();
        corsOptions = require('../../../configuration/corsOptions').default;
    });

    it('should export a configuration object', () => {
        expect(corsOptions).toBeDefined();
        expect(typeof corsOptions).toBe('object');
    });

    it('should have correct HTTP methods configured', () => {
        expect(corsOptions.methods).toBeDefined();
        expect(Array.isArray(corsOptions.methods)).toBe(true);
        expect(corsOptions.methods).toContain('GET');
        expect(corsOptions.methods).toContain('POST');
        expect(corsOptions.methods).toContain('OPTIONS');
        expect(corsOptions.methods).toHaveLength(3);
    });

    it('should have required headers configured', () => {
        expect(corsOptions.allowedHeaders).toBeDefined();
        expect(Array.isArray(corsOptions.allowedHeaders)).toBe(true);
        expect(corsOptions.allowedHeaders).toContain('Content-Type');
        expect(corsOptions.allowedHeaders).toContain('Authorization');
        expect(corsOptions.allowedHeaders).toContain('X-Request-ID');
        expect(corsOptions.allowedHeaders).toContain('X-Client-Version');
        expect(corsOptions.allowedHeaders).toContain('Apollo-Require-Preflight');
    });

    it('should have credentials enabled', () => {
        expect(corsOptions.credentials).toBe(true);
    });

    it('should have appropriate preflight cache duration', () => {
        expect(corsOptions.maxAge).toBe(86400); // 24 hours
        expect(typeof corsOptions.maxAge).toBe('number');
    });

    it('should have origin validation function', () => {
        expect(corsOptions.origin).toBeDefined();
        expect(typeof corsOptions.origin).toBe('function');
    });

    describe('Origin Validation', () => {
        let mockCallback: jest.Mock;

        beforeEach(() => {
            mockCallback = jest.fn();
        });

        it('should allow requests with no origin (mobile apps, server-to-server)', () => {
            corsOptions.origin(undefined, mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(null, true);
        });

        it('should allow exact domain matches', () => {
            corsOptions.origin('https://example.com', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(null, true);
        });

        it('should allow subdomain matches', () => {
            corsOptions.origin('https://app.example.com', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(null, true);

            corsOptions.origin('https://api.test.com', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(null, true);
        });

        it('should block unauthorized domains', () => {
            corsOptions.origin('https://malicious.com', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should block fake subdomains', () => {
            corsOptions.origin('https://malicious-example.com', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should handle different protocols correctly', () => {
            corsOptions.origin('http://example.com', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(null, true);

            corsOptions.origin('https://example.com:8080', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(null, true);
        });

        it('should handle malformed URLs', () => {
            corsOptions.origin('not-a-valid-url', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));

            corsOptions.origin('://invalid', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should handle multiple configured origins', () => {
            corsOptions.origin('https://test.com', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(null, true);

            corsOptions.origin('https://staging.test.com', mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(null, true);
        });
    });

    describe('Environment-specific Behavior', () => {
        afterEach(() => {
            jest.resetModules();
        });

        it('should handle localhost in development mode', () => {
            jest.resetModules();

            jest.doMock('../../../managers/environmentManager', () => ({
                serverConfiguration: {
                    nodeEnv: 'development',
                    logLevel: 'error'
                },
                corsConfiguration: {
                    allowedOrigins: 'localhost:3000,localhost:8080'
                }
            }));

            const devCorsOptions = require('../../../configuration/corsOptions').default;
            const devCallback = jest.fn();

            devCorsOptions.origin('http://localhost:3000', devCallback);
            expect(devCallback).toHaveBeenCalledWith(null, true);

            devCorsOptions.origin('http://localhost:8080', devCallback);
            expect(devCallback).toHaveBeenCalledWith(null, true);
        });

        it('should handle production mode with strict validation', () => {
            jest.resetModules();

            jest.doMock('../../../managers/environmentManager', () => ({
                serverConfiguration: {
                    nodeEnv: 'production',
                    logLevel: 'error'
                },
                corsConfiguration: {
                    allowedOrigins: 'example.com,api.example.com'
                }
            }));

            const prodCorsOptions = require('../../../configuration/corsOptions').default;
            const prodCallback = jest.fn();

            // Should allow configured domains
            prodCorsOptions.origin('https://example.com', prodCallback);
            expect(prodCallback).toHaveBeenCalledWith(null, true);

            // Should block localhost in production
            prodCallback.mockClear();
            prodCorsOptions.origin('http://localhost:3000', prodCallback);
            expect(prodCallback).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should handle empty origin configuration gracefully', () => {
            jest.resetModules();

            jest.doMock('../../../managers/environmentManager', () => ({
                serverConfiguration: {
                    nodeEnv: 'production',
                    logLevel: 'error'
                },
                corsConfiguration: {
                    allowedOrigins: ''
                }
            }));

            const emptyCorsOptions = require('../../../configuration/corsOptions').default;
            const emptyCallback = jest.fn();

            emptyCorsOptions.origin('https://example.com', emptyCallback);
            expect(emptyCallback).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should handle origins with trailing/leading spaces', () => {
            jest.resetModules();

            jest.doMock('../../../managers/environmentManager', () => ({
                serverConfiguration: {
                    nodeEnv: 'production',
                    logLevel: 'error'
                },
                corsConfiguration: {
                    allowedOrigins: ' example.com , test.com '
                }
            }));

            const spacedCorsOptions = require('../../../configuration/corsOptions').default;
            const spacedCallback = jest.fn();

            spacedCorsOptions.origin('https://example.com', spacedCallback);
            expect(spacedCallback).toHaveBeenCalledWith(null, true);

            spacedCorsOptions.origin('https://test.com', spacedCallback);
            expect(spacedCallback).toHaveBeenCalledWith(null, true);
        });
    });

    describe('Security Configuration', () => {
        it('should not allow all origins with wildcard', () => {
            expect(corsOptions.origin).not.toBe('*');
            expect(corsOptions.origin).not.toBe(true);
        });

        it('should have restrictive method list', () => {
            // Should not include potentially dangerous methods
            expect(corsOptions.methods).not.toContain('DELETE');
            expect(corsOptions.methods).not.toContain('PUT');
            expect(corsOptions.methods).not.toContain('PATCH');
        });

        it('should have reasonable preflight cache duration', () => {
            // Not too short (performance) or too long (security)
            expect(corsOptions.maxAge).toBeGreaterThan(3600); // At least 1 hour
            expect(corsOptions.maxAge).toBeLessThanOrEqual(86400); // At most 24 hours
        });

        it('should include essential GraphQL headers', () => {
            const essentialHeaders = ['Content-Type', 'Authorization'];
            essentialHeaders.forEach(header => {
                expect(corsOptions.allowedHeaders).toContain(header);
            });
        });

        it('should include Apollo-specific headers for GraphQL', () => {
            expect(corsOptions.allowedHeaders).toContain('Apollo-Require-Preflight');
        });
    });

    describe('GraphQL-Specific Configuration', () => {
        it('should support POST method for GraphQL mutations', () => {
            expect(corsOptions.methods).toContain('POST');
        });

        it('should support OPTIONS method for preflight requests', () => {
            expect(corsOptions.methods).toContain('OPTIONS');
        });

        it('should support GET method for GraphQL queries (if enabled)', () => {
            expect(corsOptions.methods).toContain('GET');
        });

        it('should enable credentials for authentication', () => {
            expect(corsOptions.credentials).toBe(true);
        });
    });
});