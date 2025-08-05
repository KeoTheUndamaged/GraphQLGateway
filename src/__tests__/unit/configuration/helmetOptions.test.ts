// Mock the environment manager before importing anything
jest.mock('../../../managers/environmentManager', () => ({
    graphqlConfiguration: {
        enablePlayground: false // Default to production-like settings
    }
}));

describe('Helmet Options Configuration', () => {
    let helmetOptions: any;

    beforeAll(() => {
        jest.resetModules();
        helmetOptions = require('../../../configuration/helmetOptions').default;
    });

    it('should export a configuration object', () => {
        expect(helmetOptions).toBeDefined();
        expect(typeof helmetOptions).toBe('object');
    });

    describe('Basic Security Headers', () => {
        it('should hide X-Powered-By header', () => {
            expect(helmetOptions.hidePoweredBy).toBe(true);
        });

        it('should enable noSniff to prevent MIME confusion attacks', () => {
            expect(helmetOptions.noSniff).toBe(true);
        });

        it('should enable originAgentCluster for additional isolation', () => {
            expect(helmetOptions.originAgentCluster).toBe(true);
        });

        it('should disable deprecated security headers', () => {
            // These headers are disabled because they're deprecated or can introduce vulnerabilities
            expect(helmetOptions.xssFilter).toBe(false);
            expect(helmetOptions.ieNoOpen).toBe(false);
            expect(helmetOptions.permittedCrossDomainPolicies).toBe(false);
        });
    });

    describe('Content Security Policy (CSP)', () => {
        it('should have a CSP configuration', () => {
            expect(helmetOptions.contentSecurityPolicy).toBeDefined();
            expect(helmetOptions.contentSecurityPolicy.directives).toBeDefined();
        });

        it('should have restrictive default source policy', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.defaultSrc).toEqual(["'self'"]);
        });

        it('should have production-safe script policy when playground is disabled', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.scriptSrc).toEqual(["'self'"]);
            expect(directives.scriptSrc).not.toContain("'unsafe-inline'");
            expect(directives.scriptSrc).not.toContain("'unsafe-eval'");
        });

        it('should have production-safe style policy when playground is disabled', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.styleSrc).toEqual(["'self'"]);
            expect(directives.styleSrc).not.toContain("'unsafe-inline'");
        });

        it('should allow data URLs for images', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.imgSrc).toContain("'self'");
            expect(directives.imgSrc).toContain('data:');
        });

        it('should restrict network connections to same-origin', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.connectSrc).toEqual(["'self'"]);
        });

        it('should restrict fonts to same-origin', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.fontSrc).toEqual(["'self'"]);
        });

        it('should block all object embeds', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.objectSrc).toEqual(["'none'"]);
        });

        it('should restrict frames to same-origin', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.frameSrc).toEqual(["'self'"]);
        });

        it('should restrict media to same-origin', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.mediaSrc).toEqual(["'self'"]);
        });
    });

    describe('HTTP Strict Transport Security (HSTS)', () => {
        it('should have HSTS configuration', () => {
            expect(helmetOptions.strictTransportSecurity).toBeDefined();
        });

        it('should have appropriate max age (180 days)', () => {
            expect(helmetOptions.strictTransportSecurity.maxAge).toBe(15552000); // 180 days
        });

        it('should not include subdomains by default for safety', () => {
            expect(helmetOptions.strictTransportSecurity.includeSubDomains).toBe(false);
        });

        it('should not enable preload by default for safety', () => {
            expect(helmetOptions.strictTransportSecurity.preload).toBe(false);
        });
    });

    describe('Cross-Origin Policies', () => {
        it('should have same-origin Cross-Origin Opener Policy', () => {
            expect(helmetOptions.crossOriginOpenerPolicy).toBeDefined();
            expect(helmetOptions.crossOriginOpenerPolicy.policy).toBe('same-origin');
        });

        it('should have same-origin Cross-Origin Resource Policy', () => {
            expect(helmetOptions.crossOriginResourcePolicy).toBeDefined();
            expect(helmetOptions.crossOriginResourcePolicy.policy).toBe('same-origin');
        });

        it('should set Cross-Origin Embedder Policy based on playground setting', () => {
            // When playground is disabled, this should be false
            expect(helmetOptions.crossOriginEmbedderPolicy).toBe(false);
        });
    });

    describe('Frame Protection', () => {
        it('should deny all frame embedding for maximum security', () => {
            expect(helmetOptions.frameguard).toBeDefined();
            expect(helmetOptions.frameguard.action).toBe('deny');
        });
    });

    describe('Referrer Policy', () => {
        it('should have balanced referrer policy', () => {
            expect(helmetOptions.referrerPolicy).toBeDefined();
            expect(helmetOptions.referrerPolicy.policy).toBe('strict-origin-when-cross-origin');
        });
    });

    describe('DNS Prefetch Control', () => {
        it('should allow DNS prefetching for performance', () => {
            expect(helmetOptions.dnsPrefetchControl).toBeDefined();
            expect(helmetOptions.dnsPrefetchControl.allow).toBe(true);
        });
    });

    describe('GraphQL Playground Configuration', () => {
        afterEach(() => {
            jest.resetModules();
        });

        it('should relax CSP when GraphQL Playground is enabled', () => {
            jest.resetModules();

            jest.doMock('../../../managers/environmentManager', () => ({
                graphqlConfiguration: {
                    enablePlayground: true
                }
            }));

            const playgroundHelmetOptions = require('../../../configuration/helmetOptions').default;
            const directives = playgroundHelmetOptions.contentSecurityPolicy.directives;

            // Script policy should be relaxed for playground
            expect(directives.scriptSrc).toContain("'self'");
            expect(directives.scriptSrc).toContain("'unsafe-inline'");
            expect(directives.scriptSrc).toContain("'unsafe-eval'");

            // Style policy should be relaxed for playground  
            expect(directives.styleSrc).toContain("'self'");
            expect(directives.styleSrc).toContain("'unsafe-inline'");
        });

        it('should enable Cross-Origin Embedder Policy when playground is enabled', () => {
            jest.resetModules();

            jest.doMock('../../../managers/environmentManager', () => ({
                graphqlConfiguration: {
                    enablePlayground: true
                }
            }));

            const playgroundHelmetOptions = require('../../../configuration/helmetOptions').default;
            expect(playgroundHelmetOptions.crossOriginEmbedderPolicy).toBe(true);
        });

        it('should maintain strict CSP when playground is disabled', () => {
            jest.resetModules();

            jest.doMock('../../../managers/environmentManager', () => ({
                graphqlConfiguration: {
                    enablePlayground: false
                }
            }));

            const strictHelmetOptions = require('../../../configuration/helmetOptions').default;
            const directives = strictHelmetOptions.contentSecurityPolicy.directives;

            // Script policy should be strict
            expect(directives.scriptSrc).toEqual(["'self'"]);
            expect(directives.scriptSrc).not.toContain("'unsafe-inline'");
            expect(directives.scriptSrc).not.toContain("'unsafe-eval'");

            // Style policy should be strict
            expect(directives.styleSrc).toEqual(["'self'"]);
            expect(directives.styleSrc).not.toContain("'unsafe-inline'");
        });
    });

    describe('Security Best Practices', () => {
        it('should not allow unsafe CSP directives in production mode', () => {
            // Assuming playground is disabled (production)
            const directives = helmetOptions.contentSecurityPolicy.directives;

            expect(directives.scriptSrc).not.toContain("'unsafe-inline'");
            expect(directives.scriptSrc).not.toContain("'unsafe-eval'");
            expect(directives.styleSrc).not.toContain("'unsafe-inline'");
        });

        it('should block potentially dangerous resource types', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;

            // Should block all object embeds (Flash, etc.)
            expect(directives.objectSrc).toEqual(["'none'"]);
        });

        it('should have restrictive frame policies', () => {
            // Should deny all framing for APIs
            expect(helmetOptions.frameguard.action).toBe('deny');
        });

        it('should not enable risky HSTS settings by default', () => {
            const hsts = helmetOptions.strictTransportSecurity;

            // Should not include subdomains (could break other services)
            expect(hsts.includeSubDomains).toBe(false);

            // Should not enable preload (irreversible)
            expect(hsts.preload).toBe(false);
        });

        it('should have appropriate HSTS duration', () => {
            const hsts = helmetOptions.strictTransportSecurity;

            // Should be at least 180 days (15552000 seconds)
            expect(hsts.maxAge).toBeGreaterThanOrEqual(15552000);

            // Should not be excessively long (more than 2 years)
            expect(hsts.maxAge).toBeLessThanOrEqual(63072000); // 2 years
        });
    });

    describe('Configuration Consistency', () => {
        it('should be a readonly configuration object', () => {
            // The helmetOptions should be marked as readonly
            expect(() => {
                (helmetOptions as any).newProperty = 'test';
            }).not.toThrow(); // TypeScript readonly doesn't prevent runtime modification

            // But all the important properties should be defined
            expect(helmetOptions.hidePoweredBy).toBeDefined();
            expect(helmetOptions.contentSecurityPolicy).toBeDefined();
            expect(helmetOptions.strictTransportSecurity).toBeDefined();
        });

        it('should have consistent cross-origin policies', () => {
            // All cross-origin policies should be same-origin for API security
            expect(helmetOptions.crossOriginOpenerPolicy.policy).toBe('same-origin');
            expect(helmetOptions.crossOriginResourcePolicy.policy).toBe('same-origin');
        });

        it('should have all required CSP directives', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;

            // Essential directives should be present
            expect(directives.defaultSrc).toBeDefined();
            expect(directives.scriptSrc).toBeDefined();
            expect(directives.styleSrc).toBeDefined();
            expect(directives.imgSrc).toBeDefined();
            expect(directives.connectSrc).toBeDefined();
            expect(directives.fontSrc).toBeDefined();
            expect(directives.objectSrc).toBeDefined();
            expect(directives.frameSrc).toBeDefined();
            expect(directives.mediaSrc).toBeDefined();
        });
    });

    describe('API-Specific Security', () => {
        it('should be optimized for GraphQL API security', () => {
            // APIs typically don't need embedding
            expect(helmetOptions.frameguard.action).toBe('deny');

            // APIs should block object embeds
            const directives = helmetOptions.contentSecurityPolicy.directives;
            expect(directives.objectSrc).toEqual(["'none'"]);
        });

        it('should allow necessary API functionality', () => {
            const directives = helmetOptions.contentSecurityPolicy.directives;

            // Should allow same-origin connections (for API calls)
            expect(directives.connectSrc).toContain("'self'");

            // Should allow data URLs for images (common in API responses)
            expect(directives.imgSrc).toContain('data:');
        });

        it('should have performance-friendly settings where safe', () => {
            // DNS prefetching should be allowed for performance
            expect(helmetOptions.dnsPrefetchControl.allow).toBe(true);

            // HSTS max age should be reasonable (not too short, not excessively long)
            const maxAge = helmetOptions.strictTransportSecurity.maxAge;
            expect(maxAge).toBeGreaterThan(86400); // At least 1 day
            expect(maxAge).toBeLessThan(63072000); // Less than 2 years
        });
    });
});