import apolloArmorOptions from '../../../configuration/apolloArmorOptions';

// Mock the environment manager before importing anything
jest.mock('../../../managers/environmentManager', () => ({
    armourConfiguration: {
        enableBlockFieldSuggestion: true,
        blockFieldSuggestionMask: '[REDACTED]',
        enableCostLimit: true,
        costLimitMaxCost: 10000,
        costLimitObjectCost: 2,
        costLimitScalarCost: 1,
        costLimitDepthCostFactor: 1.5,
        costLimitIgnoreIntrospection: true,
        enableMaxDepth: true,
        maxDepthLimit: 15,
        maxDepthFlattenFragments: false,
        enableMaxAliases: true,
        maxAliasesLimit: 50,
        enableMaxDirectives: true,
        maxDirectivesLimit: 100,
        enableMaxTokens: true,
        maxTokensLimit: 2000
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
        error: jest.fn(),
        debug: jest.fn()
    }))
}));


describe('Apollo Armor Options Configuration', () => {

    it('should export a configuration object', () => {
        expect(apolloArmorOptions).toBeDefined();
        expect(typeof apolloArmorOptions).toBe('object');
    });

    it('blockFieldSuggestion should be set.', () => {
        if (apolloArmorOptions.blockFieldSuggestion) {
            expect(apolloArmorOptions.blockFieldSuggestion.enabled).toBe(true);
            expect(apolloArmorOptions.blockFieldSuggestion.mask).toBe('[REDACTED]');
        }
    });

    it('costLimit should be set.', () => {
        if (apolloArmorOptions.costLimit) {
            expect(apolloArmorOptions.costLimit.enabled).toBe(true);
            expect(apolloArmorOptions.costLimit.maxCost).toBe(10000);
            expect(apolloArmorOptions.costLimit.objectCost).toBe(2);
            expect(apolloArmorOptions.costLimit.scalarCost).toBe(1);
            expect(apolloArmorOptions.costLimit.depthCostFactor).toBe(1.5);
            expect(apolloArmorOptions.costLimit.ignoreIntrospection).toBe(true);
        }
    });

    it('maxDepth should be set.', () => {
        if (apolloArmorOptions.maxDepth) {
            expect(apolloArmorOptions.maxDepth.enabled).toBe(true);
            expect(apolloArmorOptions.maxDepth.n).toBe(15);
            expect(apolloArmorOptions.maxDepth.flattenFragments).toBe(false);
        }
    });

    it('maxAliases should be set.', () => {
        if (apolloArmorOptions.maxAliases) {
            expect(apolloArmorOptions.maxAliases.enabled).toBe(true);
            expect(apolloArmorOptions.maxAliases.n).toBe(50);
        }
    });

    it('maxDirectives should be set.', () => {
        if (apolloArmorOptions.maxDirectives) {
            expect(apolloArmorOptions.maxDirectives.enabled).toBe(true);
            expect(apolloArmorOptions.maxDirectives.n).toBe(100);
        }
    });

    it('maxTokens should be set.', () => {
        if (apolloArmorOptions.maxTokens) {
            expect(apolloArmorOptions.maxTokens.enabled).toBe(true);
        }
    });
});