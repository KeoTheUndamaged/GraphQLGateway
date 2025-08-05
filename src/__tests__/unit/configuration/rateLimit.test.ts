import rateLimitOptions from '../../../configuration/rateLimitOptions';

// Mock the environment manager before importing anything
jest.mock('../../../managers/environmentManager', () => ({
    rateLimitConfiguration: {
        rateLimitWindow: 900000,
        rateLimitMax: 100,
        enableRateLimit: true
    },
    serverConfiguration: {
        logLevel: 'error'
    }
}));

// Mock the logger manager
jest.mock('../../../managers/loggerManager', () => ({
    createLogger: jest.fn(() => ({
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn()
    }))
}));

describe('Rate Limit Options Configuration (Simple)', () => {

    it('should export a configuration object', () => {
        expect(rateLimitOptions).toBeDefined();
        expect(typeof rateLimitOptions).toBe('object');
    });

    it('should have windowMs property', () => {
        expect(rateLimitOptions.windowMs).toBe(900000);
    });

    it('should have limit property', () => {
        expect(rateLimitOptions.limit).toBe(100);
    });

    it('should have standardHeaders enabled', () => {
        expect(rateLimitOptions.standardHeaders).toBe(true);
    });

    it('should have legacyHeaders disabled', () => {
        expect(rateLimitOptions.legacyHeaders).toBe(false);
    });

    it('should have a handler function', () => {
        expect(rateLimitOptions.handler).toBeDefined();
        expect(typeof rateLimitOptions.handler).toBe('function');
    });

    it('should return 429 status when rate limit exceeded', () => {
        const mockReq = {
            ip: '127.0.0.1',
            get: jest.fn(() => 'Test User Agent'),
            path: '/graphql',
            method: 'POST'
        };

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        rateLimitOptions.handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(429);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({
                    message: 'Too many requests from this IP, please try again later.',
                    code: 'RATE_LIMIT_EXCEEDED',
                    type: 'RateLimitError'
                })
            })
        );
    });
});