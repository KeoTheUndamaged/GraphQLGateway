// Mock the logger manager before importing anything
const mockLogger = {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

jest.mock('../../../managers/loggerManager', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

// Mock the environment manager before importing anything
jest.mock('../../../managers/environmentManager', () => ({
    serverConfiguration: {
        nodeEnv: 'production',
        logLevel: 'error'
    }
}));

describe('Apollo Format Error Options', () => {
    let formatError: any;

    beforeAll(() => {
        jest.resetModules();
        const module = require('../../../configuration/apolloFormatErrorOptions');
        formatError = module.default;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should export a function', () => {
        expect(formatError).toBeDefined();
        expect(typeof formatError).toBe('function');
    });

    describe('Development vs Production Environment', () => {
        it('should return full error details in development', () => {
            jest.resetModules();

            jest.doMock('../../../managers/environmentManager', () => ({
                serverConfiguration: {
                    nodeEnv: 'development',
                    logLevel: 'debug'
                }
            }));

            const devFormatError = require('../../../configuration/apolloFormatErrorOptions').default;

            const error = {
                message: 'Detailed error message',
                extensions: {
                    code: 'SOME_ERROR',
                    stack: 'Error stack trace...'
                },
                path: ['user', 'id'],
                locations: [{ line: 1, column: 1 }]
            };

            const result = devFormatError(error, new Error('Original error'));

            // In development, should return the original error unchanged
            expect(result).toEqual(error);

            // Should still log the error
            expect(mockLogger.error).toHaveBeenCalledWith(
                'GraphQL Error Occurred',
                expect.objectContaining({
                    message: 'Detailed error message',
                    code: 'SOME_ERROR'
                })
            );
        });

        it('should sanitize errors in production', () => {
            const error = {
                message: 'Sensitive database error',
                extensions: {
                    code: 'DATABASE_ERROR',
                    stack: 'Error stack trace...'
                },
                path: ['user', 'id']
            };

            const result = formatError(error, new Error('Original error'));

            // In production, should sanitize unsafe errors
            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });

            // Should log the original error details
            expect(mockLogger.error).toHaveBeenCalledWith(
                'GraphQL Error Occurred',
                expect.objectContaining({
                    message: 'Sensitive database error',
                    code: 'DATABASE_ERROR'
                })
            );
        });
    });

    describe('Introspection Error Handling', () => {
        it('should handle introspection disabled errors specifically', () => {
            const introspectionError = {
                message: 'GraphQL introspection is not allowed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED'
                }
            };

            const result = formatError(introspectionError, new Error());

            expect(result).toEqual({
                message: 'GraphQL introspection is disabled',
                extensions: {
                    code: 'INTROSPECTION_DISABLED',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should handle introspection errors with different message variations', () => {
            const introspectionError = {
                message: 'Field "__schema" is not allowed because introspection is not allowed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED'
                }
            };

            const result = formatError(introspectionError, new Error());

            expect(result).toEqual({
                message: 'GraphQL introspection is disabled',
                extensions: {
                    code: 'INTROSPECTION_DISABLED',
                    timestamp: expect.any(String)
                }
            });
        });
    });

    describe('Nested Subgraph Error Handling', () => {
        it('should extract and format safe nested errors from subgraph responses', () => {
            const nestedError = {
                message: 'Gateway error',
                extensions: {
                    code: 'GATEWAY_ERROR',
                    response: {
                        body: {
                            errors: [
                                {
                                    message: 'Validation failed',
                                    extensions: {
                                        code: 'GRAPHQL_VALIDATION_FAILED' // Using a known safe code
                                    }
                                }
                            ]
                        }
                    }
                }
            };

            const result = formatError(nestedError, new Error());

            expect(result).toEqual({
                message: 'Validation failed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should handle malformed nested error responses gracefully', () => {
            // Mock a malformed response that will cause JSON parsing to fail
            const malformedError = {
                message: 'Gateway error',
                extensions: {
                    code: 'GATEWAY_ERROR',
                    response: {
                        // This will cause an error when trying to access .body.errors
                        body: null
                    }
                }
            };

            const result = formatError(malformedError, new Error());

            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should handle nested errors with no errors array', () => {
            const nestedError = {
                message: 'Gateway error',
                extensions: {
                    code: 'GATEWAY_ERROR',
                    response: {
                        body: {
                            data: null
                        }
                    }
                }
            };

            const result = formatError(nestedError, new Error());

            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should handle nested errors with empty errors array', () => {
            const nestedError = {
                message: 'Gateway error',
                extensions: {
                    code: 'GATEWAY_ERROR',
                    response: {
                        body: {
                            errors: []
                        }
                    }
                }
            };

            const result = formatError(nestedError, new Error());

            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should reject unsafe nested error codes', () => {
            const unsafeNestedError = {
                message: 'Gateway error',
                extensions: {
                    code: 'GATEWAY_ERROR',
                    response: {
                        body: {
                            errors: [
                                {
                                    message: 'Database connection failed',
                                    extensions: {
                                        code: 'DATABASE_ERROR' // This should not be in safeErrorCodes
                                    }
                                }
                            ]
                        }
                    }
                }
            };

            const result = formatError(unsafeNestedError, new Error());

            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });
        });
    });

    describe('Top-level Error Handling', () => {
        it('should handle safe top-level error codes', () => {
            const safeError = {
                message: 'Validation failed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED', // Using known safe code
                    field: 'username'
                }
            };

            const result = formatError(safeError, new Error());

            expect(result).toEqual({
                message: 'Validation failed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should reject unsafe top-level error codes', () => {
            const unsafeError = {
                message: 'Internal database error',
                extensions: {
                    code: 'DATABASE_CONNECTION_FAILED',
                    details: 'Connection to PostgreSQL failed'
                }
            };

            const result = formatError(unsafeError, new Error());

            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should handle errors without extensions', () => {
            const errorWithoutExtensions = {
                message: 'Something went wrong'
            };

            const result = formatError(errorWithoutExtensions, new Error());

            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should handle errors with null extensions', () => {
            const errorWithNullExtensions = {
                message: 'Something went wrong',
                extensions: null
            };

            const result = formatError(errorWithNullExtensions, new Error());

            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });
        });
    });

    describe('Security and Information Disclosure', () => {
        it('should not expose sensitive error details', () => {
            const sensitiveError = {
                message: 'Connection failed: postgres://user:password@localhost:5432/db',
                extensions: {
                    code: 'SENSITIVE_ERROR',
                    stack: 'Error: at Database.connect...',
                    sql: "SELECT * FROM users WHERE password = ..."
                }
            };

            const result = formatError(sensitiveError, new Error());

            expect(result).toEqual({
                message: 'An internal server error occurred',
                extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    timestamp: expect.any(String)
                }
            });

            // Should not contain any sensitive information
            expect(JSON.stringify(result)).not.toContain('password');
            expect(JSON.stringify(result)).not.toContain('postgres://');
            expect(JSON.stringify(result)).not.toContain('stack');
            expect(JSON.stringify(result)).not.toContain('sql');
        });

        it('should sanitize error messages from safe error codes', () => {
            const errorWithSafeCode = {
                message: 'Field validation failed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED' // Using known safe code
                }
            };

            const result = formatError(errorWithSafeCode, new Error());

            expect(result.message).toBe('Field validation failed');
            expect(result.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
            expect(result.extensions?.timestamp).toBeDefined();
        });
    });

    describe('Timestamp Handling', () => {
        it('should add timestamp to all formatted errors', () => {
            const error = {
                message: 'Test error',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED'
                }
            };

            const result = formatError(error, new Error());

            expect(result.extensions?.timestamp).toBeDefined();
            expect(typeof result.extensions?.timestamp).toBe('string');

            // Should be a valid ISO string
            const timestamp = new Date(result.extensions?.timestamp as string);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).not.toBeNaN();
        });

        it('should use current timestamp for each error', async () => {
            const error = {
                message: 'Test error',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED'
                }
            };

            const result1 = formatError(error, new Error());

            // Wait to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            const result2 = formatError(error, new Error());
            expect(result1.extensions?.timestamp).not.toEqual(result2.extensions?.timestamp);
        });
    });

    describe('Error Code Validation', () => {
        it('should allow GRAPHQL_VALIDATION_FAILED error code', () => {
            const error = {
                message: 'GraphQL validation error',
                extensions: { code: 'GRAPHQL_VALIDATION_FAILED' }
            };

            const result = formatError(error, new Error());

            expect(result.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
            expect(result.message).toBe('GraphQL validation error');
        });

        // Test cases for unsafe error codes that should be blocked
        const unsafeErrorTestCases = [
            { code: 'DATABASE_ERROR', description: 'Database errors' },
            { code: 'FILE_SYSTEM_ERROR', description: 'File system errors' },
            { code: 'NETWORK_ERROR', description: 'Network errors' },
            { code: 'INTERNAL_ERROR', description: 'Internal system errors' },
            { code: 'USER_NOT_FOUND', description: 'User not found errors' },
            { code: 'UNAUTHORIZED', description: 'Authorization errors' },
            { code: 'BAD_REQUEST', description: 'Bad request errors' }
        ];

        unsafeErrorTestCases.forEach(({ code, description }) => {
            it(`should block unsafe error code: ${code} (${description})`, () => {
                const error = {
                    message: `Sensitive error for ${code}`,
                    extensions: { code }
                };

                const result = formatError(error, new Error());

                expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
                expect(result.message).toBe('An internal server error occurred');
            });
        });
    });

    describe('Error Processing Priority', () => {
        it('should prioritize introspection errors over nested errors', () => {
            const introspectionError = {
                message: 'GraphQL introspection is not allowed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED',
                    response: {
                        body: {
                            errors: [
                                {
                                    message: 'Some other error',
                                    extensions: {
                                        code: 'OTHER_ERROR'
                                    }
                                }
                            ]
                        }
                    }
                }
            };

            const result = formatError(introspectionError, new Error());

            expect(result).toEqual({
                message: 'GraphQL introspection is disabled',
                extensions: {
                    code: 'INTROSPECTION_DISABLED',
                    timestamp: expect.any(String)
                }
            });
        });

        it('should prioritize nested errors over top-level errors', () => {
            const error = {
                message: 'Gateway error',
                extensions: {
                    code: 'GATEWAY_ERROR', // This would normally be unsafe
                    response: {
                        body: {
                            errors: [
                                {
                                    message: 'Validation failed',
                                    extensions: {
                                        code: 'GRAPHQL_VALIDATION_FAILED' // This is safe
                                    }
                                }
                            ]
                        }
                    }
                }
            };

            const result = formatError(error, new Error());

            expect(result).toEqual({
                message: 'Validation failed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED',
                    timestamp: expect.any(String)
                }
            });
        });
    });

    describe('Error Logging', () => {
        it('should log all errors with complete details', () => {
            const error = {
                message: 'Test error',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED'
                },
                path: ['user', 'name'],
                locations: [{ line: 1, column: 1 }]
            };

            const originalError = new Error('Original error');

            formatError(error, originalError);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'GraphQL Error Occurred',
                {
                    message: 'Test error',
                    code: 'GRAPHQL_VALIDATION_FAILED',
                    path: ['user', 'name'],
                    locations: [{ line: 1, column: 1 }],
                    rawError: originalError
                }
            );
        });

        it('should log errors even when they are sanitized', () => {
            const error = {
                message: 'Sensitive database error',
                extensions: {
                    code: 'DATABASE_ERROR'
                }
            };

            const originalError = new Error('Database connection failed');

            formatError(error, originalError);

            // Should log the original error details
            expect(mockLogger.error).toHaveBeenCalledWith(
                'GraphQL Error Occurred',
                {
                    message: 'Sensitive database error',
                    code: 'DATABASE_ERROR',
                    path: undefined,
                    locations: undefined,
                    rawError: originalError
                }
            );
        });

        it('should log errors from introspection handling', () => {
            const introspectionError = {
                message: 'GraphQL introspection is not allowed',
                extensions: {
                    code: 'GRAPHQL_VALIDATION_FAILED'
                }
            };

            const originalError = new Error('Introspection blocked');

            formatError(introspectionError, originalError);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'GraphQL Error Occurred',
                expect.objectContaining({
                    message: 'GraphQL introspection is not allowed',
                    code: 'GRAPHQL_VALIDATION_FAILED',
                    rawError: originalError
                })
            );
        });
    });
});