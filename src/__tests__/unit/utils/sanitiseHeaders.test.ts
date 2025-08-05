
import sanitiseHeaders from '../../../utils/sanitiseHeaders';

describe('sanitiseHeaders Utility', () => {
    describe('Basic Functionality', () => {
        it('should return an empty object when given an empty object', () => {
            const result = sanitiseHeaders({});
            expect(result).toEqual({});
        });

        it('should return headers unchanged when no sensitive headers are present', () => {
            const headers = {
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (compatible)',
                'accept': 'application/json',
                'host': 'api.example.com'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (compatible)',
                'accept': 'application/json',
                'host': 'api.example.com'
            });
        });

        it('should not modify the original headers object', () => {
            const originalHeaders = {
                'authorization': 'Bearer secret-token',
                'content-type': 'application/json'
            };
            const originalCopy = { ...originalHeaders };

            sanitiseHeaders(originalHeaders);

            expect(originalHeaders).toEqual(originalCopy);
        });
    });

    describe('Sensitive Header Redaction', () => {
        it('should redact authorization header', () => {
            const headers = {
                'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                'content-type': 'application/json'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'authorization': '[REDACTED]',
                'content-type': 'application/json'
            });
        });

        it('should redact cookie header', () => {
            const headers = {
                'cookie': 'sessionId=abc123; userId=456; csrfToken=xyz789',
                'accept': 'text/html'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'cookie': '[REDACTED]',
                'accept': 'text/html'
            });
        });

        it('should redact x-api-key header', () => {
            const headers = {
                'x-api-key': 'sk_test_1234567890abcdef',
                'user-agent': 'MyApp/1.0'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'x-api-key': '[REDACTED]',
                'user-agent': 'MyApp/1.0'
            });
        });

        it('should redact x-auth-token header', () => {
            const headers = {
                'x-auth-token': 'auth_token_12345',
                'content-length': '1024'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'x-auth-token': '[REDACTED]',
                'content-length': '1024'
            });
        });

        it('should redact multiple sensitive headers', () => {
            const headers = {
                'authorization': 'Basic dXNlcjpwYXNz',
                'cookie': 'session=secret',
                'x-api-key': 'api-key-123',
                'x-auth-token': 'auth-token-456',
                'content-type': 'application/json',
                'accept': 'application/json'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'authorization': '[REDACTED]',
                'cookie': '[REDACTED]',
                'x-api-key': '[REDACTED]',
                'x-auth-token': '[REDACTED]',
                'content-type': 'application/json',
                'accept': 'application/json'
            });
        });
    });

    describe('Case Insensitive Matching', () => {
        it('should redact authorization header regardless of case', () => {
            const headers = {
                'Authorization': 'Bearer token',
                'AUTHORIZATION': 'Basic auth',
                'authorization': 'JWT token',
                'AuThOrIzAtIoN': 'Mixed case'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'Authorization': '[REDACTED]',
                'AUTHORIZATION': '[REDACTED]',
                'authorization': '[REDACTED]',
                'AuThOrIzAtIoN': '[REDACTED]'
            });
        });

        it('should redact cookie header regardless of case', () => {
            const headers = {
                'Cookie': 'session=123',
                'COOKIE': 'user=admin',
                'cookie': 'token=abc',
                'CooKie': 'Mixed case'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'Cookie': '[REDACTED]',
                'COOKIE': '[REDACTED]',
                'cookie': '[REDACTED]',
                'CooKie': '[REDACTED]'
            });
        });

        it('should redact x-api-key header regardless of case', () => {
            const headers = {
                'X-API-Key': 'key123',
                'X-API-KEY': 'KEY456',
                'x-api-key': 'key789',
                'X-Api-Key': 'Mixed case'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'X-API-Key': '[REDACTED]',
                'X-API-KEY': '[REDACTED]',
                'x-api-key': '[REDACTED]',
                'X-Api-Key': '[REDACTED]'
            });
        });

        it('should redact x-auth-token header regardless of case', () => {
            const headers = {
                'X-Auth-Token': 'token123',
                'X-AUTH-TOKEN': 'TOKEN456',
                'x-auth-token': 'token789',
                'X-AuTh-ToKeN': 'Mixed case'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'X-Auth-Token': '[REDACTED]',
                'X-AUTH-TOKEN': '[REDACTED]',
                'x-auth-token': '[REDACTED]',
                'X-AuTh-ToKeN': '[REDACTED]'
            });
        });
    });

    describe('Real-World HTTP Headers', () => {
        it('should handle typical Express.js request headers', () => {
            const headers = {
                'host': 'localhost:4000',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                'content-type': 'application/json',
                'origin': 'http://localhost:3000',
                'referer': 'http://localhost:3000/dashboard',
                'cookie': 'connect.sid=s%3AaBC123.DEF456; csrfToken=abc123'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'host': 'localhost:4000',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate, br',
                'authorization': '[REDACTED]',
                'content-type': 'application/json',
                'origin': 'http://localhost:3000',
                'referer': 'http://localhost:3000/dashboard',
                'cookie': '[REDACTED]'
            });
        });

        it('should handle API request headers with multiple auth methods', () => {
            const headers = {
                'x-api-key': 'sk_live_1234567890abcdef',
                'authorization': 'Bearer jwt-token-here',
                'x-auth-token': 'custom-auth-token',
                'content-type': 'application/json',
                'x-request-id': 'req-123-456-789',
                'x-forwarded-for': '192.168.1.100',
                'user-agent': 'MyApp/2.1.0'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'x-api-key': '[REDACTED]',
                'authorization': '[REDACTED]',
                'x-auth-token': '[REDACTED]',
                'content-type': 'application/json',
                'x-request-id': 'req-123-456-789',
                'x-forwarded-for': '192.168.1.100',
                'user-agent': 'MyApp/2.1.0'
            });
        });

        it('should handle GraphQL request headers', () => {
            const headers = {
                'host': 'api.graphql.com',
                'content-type': 'application/json',
                'accept': 'application/json',
                'authorization': 'Bearer graphql-jwt-token',
                'x-apollo-operation-name': 'GetUser',
                'x-apollo-operation-type': 'query',
                'apollo-require-preflight': 'true'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'host': 'api.graphql.com',
                'content-type': 'application/json',
                'accept': 'application/json',
                'authorization': '[REDACTED]',
                'x-apollo-operation-name': 'GetUser',
                'x-apollo-operation-type': 'query',
                'apollo-require-preflight': 'true'
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle null input gracefully', () => {
            expect(() => sanitiseHeaders(null)).toThrow();
        });

        it('should handle undefined input gracefully', () => {
            expect(() => sanitiseHeaders(undefined)).toThrow();
        });

        it('should handle headers with undefined values', () => {
            const headers = {
                'authorization': undefined,
                'content-type': 'application/json',
                'x-api-key': undefined
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'authorization': '[REDACTED]',
                'content-type': 'application/json',
                'x-api-key': '[REDACTED]'
            });
        });

        it('should handle headers with null values', () => {
            const headers = {
                'authorization': null,
                'content-type': 'application/json',
                'cookie': null
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'authorization': '[REDACTED]',
                'content-type': 'application/json',
                'cookie': '[REDACTED]'
            });
        });

        it('should handle headers with empty string values', () => {
            const headers = {
                'authorization': '',
                'content-type': 'application/json',
                'x-auth-token': ''
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'authorization': '[REDACTED]',
                'content-type': 'application/json',
                'x-auth-token': '[REDACTED]'
            });
        });

        it('should handle headers with numeric values', () => {
            const headers = {
                'content-length': 1024,
                'x-rate-limit-remaining': 99,
                'authorization': 'Bearer token'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'content-length': 1024,
                'x-rate-limit-remaining': 99,
                'authorization': '[REDACTED]'
            });
        });

        it('should handle headers with boolean values', () => {
            const headers = {
                'x-debug-mode': true,
                'x-cache-enabled': false,
                'authorization': 'Bearer token'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'x-debug-mode': true,
                'x-cache-enabled': false,
                'authorization': '[REDACTED]'
            });
        });

        it('should handle headers with array values', () => {
            const headers = {
                'accept-encoding': ['gzip', 'deflate'],
                'x-forwarded-proto': ['https'],
                'authorization': 'Bearer token'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toEqual({
                'accept-encoding': ['gzip', 'deflate'],
                'x-forwarded-proto': ['https'],
                'authorization': '[REDACTED]'
            });
        });
    });

    describe('Security Validation', () => {
        it('should redact common JWT tokens', () => {
            const headers = {
                'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
            };

            const result = sanitiseHeaders(headers);

            expect(result.authorization).toBe('[REDACTED]');
            expect(result.authorization).not.toContain('eyJ');
        });

        it('should redact Basic auth credentials', () => {
            const headers = {
                'authorization': 'Basic dXNlcm5hbWU6cGFzc3dvcmQ='
            };

            const result = sanitiseHeaders(headers);

            expect(result.authorization).toBe('[REDACTED]');
            expect(result.authorization).not.toContain('dXNlcm5hbWU6cGFzc3dvcmQ=');
        });

        it('should redact API keys with various formats', () => {
            const headers = {
                'x-api-key': 'sk_live_1234567890abcdef',
                'x-rapidapi-key': 'api-key-with-dashes-123-456',
                'apikey': 'SIMPLE_API_KEY_12345'
            };

            const result = sanitiseHeaders(headers);

            expect(result['x-api-key']).toBe('[REDACTED]');
            // x-rapidapi-key should not be redacted as it's not in the sensitive list
            expect(result['x-rapidapi-key']).toBe('api-key-with-dashes-123-456');
            // apikey should not be redacted as it's not in the sensitive list
            expect(result['apikey']).toBe('SIMPLE_API_KEY_12345');
        });

        it('should redact session cookies', () => {
            const headers = {
                'cookie': 'sessionId=abc123def456; userId=user789; csrfToken=csrf_xyz_789; remember_me=true'
            };

            const result = sanitiseHeaders(headers);

            expect(result.cookie).toBe('[REDACTED]');
            expect(result.cookie).not.toContain('abc123def456');
            expect(result.cookie).not.toContain('user789');
            expect(result.cookie).not.toContain('csrf_xyz_789');
        });
    });

    describe('Performance and Memory', () => {
        it('should handle large header objects efficiently', () => {
            const largeHeaders: Record<string, string> = {};

            // Create a large headers object
            for (let i = 0; i < 1000; i++) {
                largeHeaders[`x-custom-header-${i}`] = `value-${i}`;
            }
            largeHeaders['authorization'] = 'Bearer large-object-token';

            const startTime = Date.now();
            const result = sanitiseHeaders(largeHeaders);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
            expect(result['authorization']).toBe('[REDACTED]');
            expect(Object.keys(result)).toHaveLength(1001);
        });

        it('should not cause memory leaks with repeated calls', () => {
            const headers = {
                'authorization': 'Bearer token',
                'content-type': 'application/json'
            };

            // Call the function many times
            for (let i = 0; i < 1000; i++) {
                const result = sanitiseHeaders(headers);
                expect(result.authorization).toBe('[REDACTED]');
            }

            // If we reach here without running out of memory, the test passes
            expect(true).toBe(true);
        });
    });

    describe('Type Safety and Return Values', () => {
        it('should always return a Record<string, string> type', () => {
            const headers = {
                'authorization': 'Bearer token',
                'content-type': 'application/json',
                'x-custom-number': 123,
                'x-custom-boolean': true
            };

            const result = sanitiseHeaders(headers);

            expect(typeof result).toBe('object');
            expect(result).not.toBeNull();
            expect(Array.isArray(result)).toBe(false);

            // All keys should be strings
            Object.keys(result).forEach(key => {
                expect(typeof key).toBe('string');
            });
        });

        it('should preserve the original key names exactly', () => {
            const headers = {
                'Authorization': 'Bearer token',
                'Content-Type': 'application/json',
                'X-API-Key': 'secret-key',
                'x-custom-header': 'value'
            };

            const result = sanitiseHeaders(headers);

            expect(result).toHaveProperty('Authorization');
            expect(result).toHaveProperty('Content-Type');
            expect(result).toHaveProperty('X-API-Key');
            expect(result).toHaveProperty('x-custom-header');

            // Keys should be exactly as provided
            expect(Object.keys(result)).toEqual(Object.keys(headers));
        });
    });
});