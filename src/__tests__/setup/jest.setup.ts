// Prevent process.exit during tests
const originalExit = process.exit;
process.exit = ((code?: number) => {
    console.warn(`process.exit(${code}) was called during tests - ignoring`);
    // Don't exit during tests
}) as any;

// Set test environment variables BEFORE any modules are loaded
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.LOG_LEVEL = 'error';
process.env.GRAPHQL_INTROSPECTION = 'true';
process.env.GRAPHQL_PLAYGROUND = 'false';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.SERVICE_NAME = 'test-gateway';
process.env.SERVICE_VERSION = '1.0.0-test';

// Mock the supergraph file
jest.mock('node:fs', () => ({
    ...jest.requireActual('node:fs'),
    readFileSync: jest.fn((path: string) => {
        if (path.includes('supergraph.graphql')) {
            return `
                extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])
                
                type Query {
                    hello: String
                }
            `;
        }
        return jest.requireActual('node:fs').readFileSync(path);
    }),
}));

// Mock OpenTelemetry modules
jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
    getNodeAutoInstrumentations: jest.fn(() => []),
}));

jest.mock('@opentelemetry/sdk-node', () => ({
    NodeSDK: jest.fn().mockImplementation(() => ({
        start: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
    })),
}));

// Restore process.exit after all tests
afterAll(() => {
    process.exit = originalExit;
});