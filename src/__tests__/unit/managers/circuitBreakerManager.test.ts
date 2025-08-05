// Mock dependencies BEFORE importing anything else
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

jest.mock('../../../managers/environmentManager', () => ({
    serverConfiguration: {
        logLevel: 'info'
    },
    circuitBreakerConfiguration: {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 10000,
        halfOpenMaxCalls: 3,
        minimumCalls: 10
    }
}));

jest.mock('../../../managers/loggerManager', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

// Mock CircuitBreaker class
const mockCircuitBreakerInstances = new Map();

jest.mock('../../../utils/circuitBreaker', () => ({
    CircuitBreaker: jest.fn().mockImplementation((name, _options, _logger) => {
        const mockInstance = {
            getStats: jest.fn(() => ({
                state: 'CLOSED',
                failures: 0,
                successes: 10,
                totalCalls: 10,
                lastFailureTime: null,
                nextAttemptTime: null
            })),
            execute: jest.fn()
        };

        // Store the mock instance so we can reference it later
        mockCircuitBreakerInstances.set(name, mockInstance);
        return mockInstance;
    })
}));

// Now import after mocks are set up
import { CircuitBreakerManager } from '../../../managers/circuitBreakerManager';
import { CircuitBreaker } from '../../../utils/circuitBreaker';

describe('CircuitBreakerManager', () => {
    let manager: CircuitBreakerManager;
    const MockedCircuitBreaker = CircuitBreaker as jest.MockedClass<typeof CircuitBreaker>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCircuitBreakerInstances.clear();
        manager = new CircuitBreakerManager();
    });

    describe('Constructor and Initialization', () => {
        it('should initialize with empty circuit breaker registry', () => {
            const stats = manager.getAllStats();
            expect(stats).toEqual({});
        });

        it('should initialize with default configuration from environment', () => {
            manager.createCircuitBreaker('test-service');

            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                'test-service',
                expect.objectContaining({
                    failureThreshold: 5,
                    recoveryTimeout: 60000,
                    monitoringPeriod: 10000,
                    halfOpenMaxCalls: 3,
                    minimumCallsRequired: 10
                }),
                expect.any(Object) // logger
            );
        });

        it('should create logger instance with configured log level', () => {
            // Logger creation is tested by verifying that circuit breakers are created with a logger
            manager.createCircuitBreaker('test-service');

            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                'test-service',
                expect.any(Object),
                expect.objectContaining({
                    info: expect.any(Function),
                    error: expect.any(Function),
                    warn: expect.any(Function),
                    debug: expect.any(Function)
                })
            );
        });
    });

    describe('createCircuitBreaker', () => {
        it('should create a new circuit breaker with default options', () => {
            const name = 'subgraph-products';
            const circuitBreaker = manager.createCircuitBreaker(name);

            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                name,
                expect.objectContaining({
                    failureThreshold: 5,
                    recoveryTimeout: 60000,
                    monitoringPeriod: 10000,
                    halfOpenMaxCalls: 3,
                    minimumCallsRequired: 10
                }),
                expect.any(Object)
            );

            expect(circuitBreaker).toBeDefined();
        });

        it('should create a circuit breaker with custom options override', () => {
            const customOptions = {
                failureThreshold: 3,
                recoveryTimeout: 30000
            };

            const circuitBreaker = manager.createCircuitBreaker('api-payment', customOptions);

            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                'api-payment',
                expect.objectContaining({
                    failureThreshold: 3, // overridden
                    recoveryTimeout: 30000, // overridden
                    monitoringPeriod: 10000, // default
                    halfOpenMaxCalls: 3, // default
                    minimumCallsRequired: 10 // default
                }),
                expect.any(Object)
            );

            expect(circuitBreaker).toBeDefined();
        });

        it('should register circuit breaker in internal registry', () => {
            const name = 'test-service';
            const created = manager.createCircuitBreaker(name);

            const retrieved = manager.getCircuitBreaker(name);
            expect(retrieved).toBeDefined();
            expect(retrieved).toBe(created);
        });

        it('should log circuit breaker creation', () => {
            const name = 'logged-service';
            const options = { failureThreshold: 7 };

            manager.createCircuitBreaker(name, options);

            expect(mockLogger.info).toHaveBeenCalledWith(
                `Created circuit breaker for ${name}`,
                expect.objectContaining({
                    failureThreshold: 7,
                    recoveryTimeout: 60000,
                    monitoringPeriod: 10000,
                    halfOpenMaxCalls: 3,
                    minimumCallsRequired: 10
                })
            );
        });

        it('should overwrite existing circuit breaker with same name', () => {
            const name = 'duplicate-service';

            // Create the first circuit breaker
            const first = manager.createCircuitBreaker(name, { failureThreshold: 3 });

            // Create second circuit breaker with same name
            const second = manager.createCircuitBreaker(name, { failureThreshold: 7 });

            // Should be different instances
            expect(first).not.toBe(second);

            // Registry should contain the second one
            const retrieved = manager.getCircuitBreaker(name);
            expect(retrieved).toBe(second);
        });

        it('should handle partial options correctly', () => {
            manager.createCircuitBreaker('partial-options', {
                failureThreshold: 2
                // other options should use defaults
            });

            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                'partial-options',
                expect.objectContaining({
                    failureThreshold: 2,
                    recoveryTimeout: 60000, // default
                    monitoringPeriod: 10000, // default
                    halfOpenMaxCalls: 3, // default
                    minimumCallsRequired: 10 // default
                }),
                expect.any(Object)
            );
        });
    });

    describe('getCircuitBreaker', () => {
        it('should return existing circuit breaker by name', () => {
            const name = 'existing-service';
            const created = manager.createCircuitBreaker(name);

            const retrieved = manager.getCircuitBreaker(name);

            expect(retrieved).toBe(created);
        });

        it('should return undefined for non-existent circuit breaker', () => {
            const retrieved = manager.getCircuitBreaker('non-existent-service');

            expect(retrieved).toBeUndefined();
        });

        it('should handle empty string name gracefully', () => {
            const retrieved = manager.getCircuitBreaker('');

            expect(retrieved).toBeUndefined();
        });
    });

    describe('getAllStats', () => {
        it('should return empty object when no circuit breakers exist', () => {
            const stats = manager.getAllStats();

            expect(stats).toEqual({});
        });

        it('should return stats for single circuit breaker', () => {
            const mockStats = {
                state: 'CLOSED',
                failures: 0,
                successes: 10,
                totalCalls: 10
            };

            // Create a circuit breaker first
            manager.createCircuitBreaker('test-service');

            // Then override the getStats method on that specific instance
            const mockInstance = mockCircuitBreakerInstances.get('test-service');
            mockInstance.getStats.mockReturnValue(mockStats);

            const stats = manager.getAllStats();

            expect(stats).toEqual({
                'test-service': mockStats
            });
            expect(mockInstance.getStats).toHaveBeenCalled();
        });

        it('should return stats for multiple circuit breakers', () => {
            const mockStats1 = { state: 'CLOSED', failures: 0 };
            const mockStats2 = { state: 'OPEN', failures: 5 };

            // Create circuit breakers first
            manager.createCircuitBreaker('service-1');
            manager.createCircuitBreaker('service-2');

            // Then override their getStats methods
            const mockInstance1 = mockCircuitBreakerInstances.get('service-1');
            const mockInstance2 = mockCircuitBreakerInstances.get('service-2');
            mockInstance1.getStats.mockReturnValue(mockStats1);
            mockInstance2.getStats.mockReturnValue(mockStats2);

            const stats = manager.getAllStats();

            expect(stats).toEqual({
                'service-1': mockStats1,
                'service-2': mockStats2
            });
        });

        it('should call getStats on each circuit breaker exactly once', () => {
            // Create circuit breakers first
            manager.createCircuitBreaker('service-1');
            manager.createCircuitBreaker('service-2');

            const mockInstance1 = mockCircuitBreakerInstances.get('service-1');
            const mockInstance2 = mockCircuitBreakerInstances.get('service-2');

            manager.getAllStats();

            expect(mockInstance1.getStats).toHaveBeenCalledTimes(1);
            expect(mockInstance2.getStats).toHaveBeenCalledTimes(1);
        });
    });

    describe('getHealthStatus', () => {
        it('should return healthy status when no circuit breakers exist', () => {
            const health = manager.getHealthStatus();

            expect(health).toEqual({
                healthy: true,
                openCircuits: [],
                totalCircuits: 0,
                stats: {}
            });
        });

        it('should return healthy status when all circuit breakers are closed', () => {
            // Create circuit breakers
            manager.createCircuitBreaker('service-1');
            manager.createCircuitBreaker('service-2');

            // Set up their stats to return CLOSED/HALF_OPEN states
            const mockInstance1 = mockCircuitBreakerInstances.get('service-1');
            const mockInstance2 = mockCircuitBreakerInstances.get('service-2');
            mockInstance1.getStats.mockReturnValue({ state: 'CLOSED', failures: 0 });
            mockInstance2.getStats.mockReturnValue({ state: 'HALF_OPEN', failures: 2 });

            const health = manager.getHealthStatus();

            expect(health).toEqual({
                healthy: true, // No OPEN circuits
                openCircuits: [],
                totalCircuits: 2,
                stats: {
                    'service-1': { state: 'CLOSED', failures: 0 },
                    'service-2': { state: 'HALF_OPEN', failures: 2 }
                }
            });
        });

        it('should return unhealthy status when circuit breakers are open', () => {
            // Create circuit breakers
            manager.createCircuitBreaker('service-1');
            manager.createCircuitBreaker('service-2');
            manager.createCircuitBreaker('service-3');

            // Set up their stats with mixed states
            const mockInstance1 = mockCircuitBreakerInstances.get('service-1');
            const mockInstance2 = mockCircuitBreakerInstances.get('service-2');
            const mockInstance3 = mockCircuitBreakerInstances.get('service-3');
            mockInstance1.getStats.mockReturnValue({ state: 'OPEN', failures: 5 });
            mockInstance2.getStats.mockReturnValue({ state: 'CLOSED', failures: 0 });
            mockInstance3.getStats.mockReturnValue({ state: 'OPEN', failures: 3 });

            const health = manager.getHealthStatus();

            expect(health).toEqual({
                healthy: false,
                openCircuits: ['service-1', 'service-3'],
                totalCircuits: 3,
                stats: {
                    'service-1': { state: 'OPEN', failures: 5 },
                    'service-2': { state: 'CLOSED', failures: 0 },
                    'service-3': { state: 'OPEN', failures: 3 }
                }
            });
        });

        it('should correctly identify open circuits from mixed states', () => {
            // Create circuit breakers
            manager.createCircuitBreaker('api-payment');
            manager.createCircuitBreaker('subgraph-products');
            manager.createCircuitBreaker('db-users');
            manager.createCircuitBreaker('external-service');

            // Set up their stats with mixed states
            const instances = [
                mockCircuitBreakerInstances.get('api-payment'),
                mockCircuitBreakerInstances.get('subgraph-products'),
                mockCircuitBreakerInstances.get('db-users'),
                mockCircuitBreakerInstances.get('external-service')
            ];

            instances[0].getStats.mockReturnValue({ state: 'OPEN', failures: 10 });
            instances[1].getStats.mockReturnValue({ state: 'CLOSED', failures: 0 });
            instances[2].getStats.mockReturnValue({ state: 'HALF_OPEN', failures: 2 });
            instances[3].getStats.mockReturnValue({ state: 'OPEN', failures: 7 });

            const health = manager.getHealthStatus();

            expect(health.healthy).toBe(false);
            expect(health.openCircuits).toEqual(['api-payment', 'external-service']);
            expect(health.totalCircuits).toBe(4);
        });

        it('should call getAllStats to gather circuit breaker information', () => {
            const getAllStatsSpy = jest.spyOn(manager, 'getAllStats');

            manager.getHealthStatus();

            expect(getAllStatsSpy).toHaveBeenCalledTimes(1);
        });

        it('should handle empty stats gracefully', () => {
            const health = manager.getHealthStatus();

            expect(health).toEqual({
                healthy: true,
                openCircuits: [],
                totalCircuits: 0,
                stats: {}
            });
        });
    });

    describe('Integration Tests', () => {
        it('should support typical workflow: create, retrieve, monitor', () => {
            // Create multiple circuit breakers
            const cb1 = manager.createCircuitBreaker('subgraph-products', {
                failureThreshold: 3
            });
            const cb2 = manager.createCircuitBreaker('api-payment');

            // Verify they can be retrieved
            expect(manager.getCircuitBreaker('subgraph-products')).toBe(cb1);
            expect(manager.getCircuitBreaker('api-payment')).toBe(cb2);

            // Verify stats collection works
            const stats = manager.getAllStats();
            expect(Object.keys(stats)).toHaveLength(2);
            expect(stats).toHaveProperty('subgraph-products');
            expect(stats).toHaveProperty('api-payment');

            // Verify health status works
            const health = manager.getHealthStatus();
            expect(health.totalCircuits).toBe(2);
            expect(health.stats).toEqual(stats);
        });

        it('should handle realistic service naming patterns', () => {
            const serviceNames = [
                'subgraph-products',
                'subgraph-users',
                'api-payment-gateway',
                'db-user-store',
                'external-inventory-service'
            ];

            // Create circuit breakers for all services
            serviceNames.forEach(name => {
                manager.createCircuitBreaker(name);
            });

            // Verify all are registered
            serviceNames.forEach(name => {
                expect(manager.getCircuitBreaker(name)).toBeDefined();
            });

            const stats = manager.getAllStats();
            expect(Object.keys(stats)).toHaveLength(serviceNames.length);

            const health = manager.getHealthStatus();
            expect(health.totalCircuits).toBe(serviceNames.length);
        });

        it('should maintain consistent state across operations', () => {
            // Create initial circuit breaker
            manager.createCircuitBreaker('test-service');

            // Verify initial state
            let stats = manager.getAllStats();
            let health = manager.getHealthStatus();
            expect(Object.keys(stats)).toHaveLength(1);
            expect(health.totalCircuits).toBe(1);

            // Add another circuit breaker
            manager.createCircuitBreaker('another-service');

            // Verify updated state
            stats = manager.getAllStats();
            health = manager.getHealthStatus();
            expect(Object.keys(stats)).toHaveLength(2);
            expect(health.totalCircuits).toBe(2);

            // Replace existing circuit breaker
            manager.createCircuitBreaker('test-service', { failureThreshold: 10 });

            // Verify state consistency
            stats = manager.getAllStats();
            health = manager.getHealthStatus();
            expect(Object.keys(stats)).toHaveLength(2); // Still 2 services
            expect(health.totalCircuits).toBe(2);
        });
    });

    describe('Error Handling', () => {
        it('should handle circuit breaker creation errors gracefully', () => {
            // Mock CircuitBreaker constructor to throw for this specific test
            MockedCircuitBreaker.mockImplementationOnce(() => {
                throw new Error('Circuit breaker creation failed');
            });

            expect(() => {
                manager.createCircuitBreaker('failing-service');
            }).toThrow('Circuit breaker creation failed');
        });

        it('should handle getStats errors from individual circuit breakers', () => {
            // Create a circuit breaker first
            manager.createCircuitBreaker('error-service');

            // Then make its getStats method throw an error
            const mockInstance = mockCircuitBreakerInstances.get('error-service');
            mockInstance.getStats.mockImplementation(() => {
                throw new Error('Stats collection failed');
            });

            expect(() => {
                manager.getAllStats();
            }).toThrow('Stats collection failed');
        });

        it('should handle malformed circuit breaker states in health status', () => {
            // Create circuit breakers
            manager.createCircuitBreaker('service-1');
            manager.createCircuitBreaker('service-2');
            manager.createCircuitBreaker('service-3');

            // Set up their stats with malformed states
            const mockInstance1 = mockCircuitBreakerInstances.get('service-1');
            const mockInstance2 = mockCircuitBreakerInstances.get('service-2');
            const mockInstance3 = mockCircuitBreakerInstances.get('service-3');

            mockInstance1.getStats.mockReturnValue({ state: 'INVALID_STATE', failures: 0 });
            mockInstance2.getStats.mockReturnValue({ state: 'OPEN', failures: 5 });
            mockInstance3.getStats.mockReturnValue({ failures: 0 }); // missing state

            const health = manager.getHealthStatus();

            // Should only identify clearly OPEN circuits
            expect(health.openCircuits).toEqual(['service-2']);
            expect(health.healthy).toBe(false);
            expect(health.totalCircuits).toBe(3);
        });
    });

    describe('Performance and Scalability', () => {
        it('should handle large number of circuit breakers efficiently', () => {
            const startTime = Date.now();

            // Create 100 circuit breakers
            for (let i = 0; i < 100; i++) {
                manager.createCircuitBreaker(`service-${i}`);
            }

            const creationTime = Date.now() - startTime;
            expect(creationTime).toBeLessThan(1000); // Should complete in under 1 second

            // Test stats collection performance
            const statsStartTime = Date.now();
            const stats = manager.getAllStats();
            const statsTime = Date.now() - statsStartTime;

            expect(Object.keys(stats)).toHaveLength(100);
            expect(statsTime).toBeLessThan(100); // Should be very fast

            // Test health status performance
            const healthStartTime = Date.now();
            const health = manager.getHealthStatus();
            const healthTime = Date.now() - healthStartTime;

            expect(health.totalCircuits).toBe(100);
            expect(healthTime).toBeLessThan(100); // Should be very fast
        });

        it('should maintain O(1) lookup performance', () => {
            // Create many circuit breakers
            for (let i = 0; i < 1000; i++) {
                manager.createCircuitBreaker(`service-${i}`);
            }

            // Test lookup performance
            const lookupStartTime = Date.now();

            // Perform many lookups
            for (let i = 0; i < 100; i++) {
                const randomIndex = Math.floor(Math.random() * 1000);
                manager.getCircuitBreaker(`service-${randomIndex}`);
            }

            const lookupTime = Date.now() - lookupStartTime;
            expect(lookupTime).toBeLessThan(50); // Should be very fast for O(1) operations
        });
    });

    describe('Configuration Management', () => {
        it('should use environment configuration as defaults', () => {
            manager.createCircuitBreaker('env-test');

            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                'env-test',
                expect.objectContaining({
                    failureThreshold: 5, // from mocked config
                    recoveryTimeout: 60000,
                    monitoringPeriod: 10000,
                    halfOpenMaxCalls: 3,
                    minimumCallsRequired: 10
                }),
                expect.any(Object)
            );
        });

        it('should allow complete configuration override', () => {
            const customConfig = {
                failureThreshold: 1,
                recoveryTimeout: 5000,
                monitoringPeriod: 2000,
                halfOpenMaxCalls: 1,
                minimumCallsRequired: 2
            };

            manager.createCircuitBreaker('custom-config', customConfig);

            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                'custom-config',
                customConfig,
                expect.any(Object)
            );
        });

        it('should merge partial configuration correctly', () => {
            const partialConfig = {
                failureThreshold: 8,
                recoveryTimeout: 45000
                // other options should use defaults
            };

            manager.createCircuitBreaker('partial-config', partialConfig);

            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                'partial-config',
                expect.objectContaining({
                    failureThreshold: 8, // overridden
                    recoveryTimeout: 45000, // overridden
                    monitoringPeriod: 10000, // default
                    halfOpenMaxCalls: 3, // default
                    minimumCallsRequired: 10 // default
                }),
                expect.any(Object)
            );
        });

        it('should create circuit breakers with proper constructor arguments', () => {
            const name = 'constructor-test';
            const options = { failureThreshold: 2 };

            manager.createCircuitBreaker(name, options);

            // Verify a constructor was called with correct arguments
            expect(MockedCircuitBreaker).toHaveBeenCalledWith(
                name, // the first argument should be the name
                expect.objectContaining(options), // the second argument should contain options
                expect.any(Object) // the third argument should be the logger
            );
        });
    });

    describe('Logging Integration', () => {
        it('should log circuit breaker creation with final merged options', () => {
            const name = 'logging-test';
            const customOptions = { failureThreshold: 8 };

            manager.createCircuitBreaker(name, customOptions);

            expect(mockLogger.info).toHaveBeenCalledWith(
                `Created circuit breaker for ${name}`,
                expect.objectContaining({
                    failureThreshold: 8, // custom value
                    recoveryTimeout: 60000, // default value
                    monitoringPeriod: 10000, // default value
                    halfOpenMaxCalls: 3, // default value
                    minimumCallsRequired: 10 // default value
                })
            );
        });

        it('should log creation for each circuit breaker individually', () => {
            manager.createCircuitBreaker('service-1');
            manager.createCircuitBreaker('service-2');

            expect(mockLogger.info).toHaveBeenCalledTimes(2);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Created circuit breaker for service-1',
                expect.any(Object)
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Created circuit breaker for service-2',
                expect.any(Object)
            );
        });
    });
});