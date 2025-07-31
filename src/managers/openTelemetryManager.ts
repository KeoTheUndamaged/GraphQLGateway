/**
 * OpenTelemetry Manager Class
 *
 * Encapsulates all OpenTelemetry initialisation, configuration, and lifecycle management.
 * Provides a clean, testable interface for observability features with proper error handling.
 *
 * Benefits of Class-Based Approach:
 * - Encapsulation: All OpenTelemetry logic contained within the class
 * - State Management: Tracks initialisation status and configuration
 * - Testability: Easy to mock and unit test
 * - Lifecycle Management: Proper startup and shutdown handling
 * - Error Isolation: Failures don't crash the application
 * - Configuration Validation: Centralised validation logic
 */

import {SDK_INFO} from '@opentelemetry/core';
// Sampling
import {NodeSDK} from '@opentelemetry/sdk-node';
import {resourceFromAttributes} from '@opentelemetry/resources';
import {ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION} from '@opentelemetry/semantic-conventions';

// Trace Exports
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {TraceIdRatioBasedSampler} from '@opentelemetry/sdk-trace-node';

// Metrics Exports
import {OTLPMetricExporter} from '@opentelemetry/exporter-metrics-otlp-http';
import {AggregationTemporality, PeriodicExportingMetricReader} from '@opentelemetry/sdk-metrics';

// Instrumentation
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {GraphQLInstrumentation} from '@opentelemetry/instrumentation-graphql';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';

import {createLogger} from './loggerManager';
import {openTelemetryConfiguration, serverConfiguration} from './environmentManager';
import {CompressionAlgorithm} from '@opentelemetry/otlp-exporter-base';

/**
 * OpenTelemetry Configuration Interface
 *
 * Defines the structure of OpenTelemetry configuration with validation status.
 */
interface OpenTelemetryConfiguration {
    tracingEnabled: boolean;
    metricsEnabled: boolean;
    hasValidTraceEndpoint: boolean;
    hasValidMetricsEndpoint: boolean;
    shouldInitialise: boolean;
}

/**
 * OpenTelemetry Initialisation Result
 *
 * Encapsulates the result of OpenTelemetry initialisation with detailed status.
 */
interface InitialisationResult {
    success: boolean;
    initialized: boolean;
    enabledFeatures: string[];
    errors: string[];
}

class OpenTelemetryManager {
    private readonly logger: ReturnType<typeof createLogger>;
    private readonly config: OpenTelemetryConfiguration;
    private sdk: NodeSDK | null = null;
    private initialized = false;
    private traceExporter: OTLPTraceExporter | null = null;
    private metricReader: PeriodicExportingMetricReader | null = null;

    constructor() {
        this.logger = createLogger(serverConfiguration.logLevel);
        this.config = this.validateConfiguration();

        // Set up process handlers if we're going to initialize
        if (this.config.shouldInitialise) {
            this.setupProcessHandlers();
        }
    }

    /**
     * Configuration Validation
     *
     * Validates OpenTelemetry configuration and determines what features can be enabled.
     * Provides detailed logging about configuration decisions.
     */
    private validateConfiguration(): OpenTelemetryConfiguration {
        const tracesEnabled = openTelemetryConfiguration.enableTraces;
        const metricsEnabled = openTelemetryConfiguration.enableMetrics;
        const hasValidTraceEndpoint = Boolean(openTelemetryConfiguration.tracesEndpointUrl);
        const hasValidMetricsEndpoint = Boolean(openTelemetryConfiguration.metricsEndpointUrl);

        // Log configuration validation results
        if (tracesEnabled && !hasValidTraceEndpoint) {
            this.logger.warn('Tracing enabled but OTEL_EXPORTER_TRACE_OTLP_ENDPOINT not configured');
        }

        if (metricsEnabled && !hasValidMetricsEndpoint) {
            this.logger.warn('Metrics enabled but OTEL_EXPORTER_METRIC_OTLP_ENDPOINT not configured');
        }

        const canEnableTracing = tracesEnabled && hasValidTraceEndpoint;
        const canEnableMetrics = metricsEnabled && hasValidMetricsEndpoint;
        const shouldInitialize = canEnableTracing || canEnableMetrics;

        if (!shouldInitialize) {
            this.logger.info('OpenTelemetry observability disabled or misconfigured - skipping initialization');
        }

        return {
            tracingEnabled: canEnableTracing,
            metricsEnabled: canEnableMetrics,
            hasValidTraceEndpoint,
            hasValidMetricsEndpoint,
            shouldInitialise: shouldInitialize,
        };
    }

    /**
     * Create Service Resource
     *
     * Creates the OpenTelemetry resource that identifies this service.
     */
    private createServiceResource() {
        return resourceFromAttributes({
            ...SDK_INFO,
            [ATTR_SERVICE_NAME]: serverConfiguration.serviceName,
            [ATTR_SERVICE_VERSION]: serverConfiguration.serviceVersion,
            'service.namespace': openTelemetryConfiguration.nameSpace || 'default',
            'deployment.environment': serverConfiguration.nodeEnv,
        });
    }

    /**
     * Create Trace Exporter
     *
     * Creates and configures the OTLP trace exporter if tracing is enabled.
     */
    private createTraceExporter(): OTLPTraceExporter | null {
        if (!this.config.tracingEnabled) {
            return null;
        }

        try {
            const exporter = new OTLPTraceExporter({
                url: openTelemetryConfiguration.tracesEndpointUrl!,
                headers: openTelemetryConfiguration.tracesHeaders || {},
                timeoutMillis: 10000,
                compression: CompressionAlgorithm.GZIP,
            });

            this.logger.info('Trace exporter configured', {
                endpoint: openTelemetryConfiguration.tracesEndpointUrl,
                samplingRate: openTelemetryConfiguration.samplingRate,
            });

            return exporter;
        } catch (error) {
            this.logger.error('Failed to create trace exporter', {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /**
     * Create Metrics Reader
     *
     * Creates and configures the periodic metrics reader if metrics are enabled.
     */
    private createMetricsReader(): PeriodicExportingMetricReader | null {
        if (!this.config.metricsEnabled) {
            return null;
        }

        try {
            const metricExporter = new OTLPMetricExporter({
                url: openTelemetryConfiguration.metricsEndpointUrl!,
                headers: openTelemetryConfiguration.metricsHeaders || {},
                timeoutMillis: 10000,
                compression: CompressionAlgorithm.GZIP,
                temporalityPreference: AggregationTemporality.CUMULATIVE,
            });

            const reader = new PeriodicExportingMetricReader({
                exporter: metricExporter,
                exportIntervalMillis: openTelemetryConfiguration.metricExportInterval,
                exportTimeoutMillis: 10000,
            });

            this.logger.info('Metrics reader configured', {
                endpoint: openTelemetryConfiguration.metricsEndpointUrl,
                exportInterval: `${openTelemetryConfiguration.metricExportInterval}ms`,
            });

            return reader;
        } catch (error) {
            this.logger.error('Failed to create metrics reader', {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /**
     * Create Instrumentations
     *
     * Creates the instrumentation configuration based on enabled features.
     */
    private createInstrumentations() {
        const instrumentations = [];

        // Basic instrumentations if any observability is enabled
        if (this.config.tracingEnabled || this.config.metricsEnabled) {
            instrumentations.push(
                getNodeAutoInstrumentations({
                    '@opentelemetry/instrumentation-fs': {
                        enabled: false, // File system operations can be very noisy
                    },
                    '@opentelemetry/instrumentation-dns': {
                        enabled: serverConfiguration.nodeEnv !== 'production',
                    },
                    '@opentelemetry/instrumentation-http': {
                        enabled: true,
                        ignoreIncomingRequestHook: (req) => {
                            const url = req.url || '';
                            return url === '/healthcheck' ||
                                url.startsWith('/static/') ||
                                url.startsWith('/favicon');
                        },
                    },
                }),

                new ExpressInstrumentation(),
                new HttpInstrumentation()
            );
        }

        // GraphQL instrumentation - particularly valuable for tracing
        if (this.config.tracingEnabled) {
            instrumentations.push(
                new GraphQLInstrumentation({
                    depth: 10,
                    allowValues: serverConfiguration.nodeEnv !== 'production',
                    mergeItems: true,
                })
            );
        }

        return instrumentations;
    }

    /**
     * Initialize OpenTelemetry SDK
     *
     * Main initialisation method that sets up the OpenTelemetry SDK with configured components.
     */
    public initialise(): InitialisationResult {
        const result: InitialisationResult = {
            success: false,
            initialized: false,
            enabledFeatures: [],
            errors: [],
        };

        // Early exit if configuration doesn't allow initialisation
        if (!this.config.shouldInitialise) {
            this.logger.info('OpenTelemetry initialization skipped due to configuration');
            return result;
        }

        try {
            // Create components
            this.traceExporter = this.createTraceExporter();
            this.metricReader = this.createMetricsReader();
            const instrumentations = this.createInstrumentations();
            const resource = this.createServiceResource();

            // Build SDK configuration
            const sdkConfig: any = {
                resource,
                instrumentations,
            };

            // Add trace configuration if available
            if (this.traceExporter) {
                sdkConfig.traceExporter = this.traceExporter;
                sdkConfig.sampler = new TraceIdRatioBasedSampler(openTelemetryConfiguration.samplingRate);
                result.enabledFeatures.push('tracing');
            }

            // Add metrics configuration if available
            if (this.metricReader) {
                sdkConfig.metricReader = this.metricReader;
                result.enabledFeatures.push('metrics');
            }

            // Create and start the SDK
            this.sdk = new NodeSDK(sdkConfig);
            this.sdk.start();
            this.initialized = true;

            this.logger.info('OpenTelemetry SDK initialized successfully', {
                serviceName: serverConfiguration.serviceName,
                serviceVersion: serverConfiguration.serviceVersion,
                enabledFeatures: result.enabledFeatures.join(', '),
                tracingEnabled: Boolean(this.traceExporter),
                metricsEnabled: Boolean(this.metricReader),
            });

            result.success = true;
            result.initialized = true;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to initialize OpenTelemetry SDK', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });

            result.errors.push(errorMessage);
            this.logger.warn('Continuing without OpenTelemetry observability');
        }

        return result;
    }

    /**
     * Graceful Shutdown
     *
     * Properly shuts down the OpenTelemetry SDK and exports any remaining data.
     */
    public async shutdown(): Promise<void> {
        if (!this.initialized || !this.sdk) {
            this.logger.info('OpenTelemetry SDK was not initialized, skipping shutdown');
            return;
        }

        this.logger.info('Shutting down OpenTelemetry SDK...', {
            tracingEnabled: Boolean(this.traceExporter),
            metricsEnabled: Boolean(this.metricReader),
        });

        try {
            await this.sdk.shutdown();
            this.initialized = false;
            this.logger.info('OpenTelemetry SDK shut down successfully');
        } catch (error) {
            this.logger.error('OpenTelemetry SDK shutdown error', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    /**
     * Process Signal Handlers Setup
     *
     * Sets up graceful shutdown handlers for process termination signals.
     */
    private setupProcessHandlers(): void {
        const handleShutdown = async (signal: string) => {
            this.logger.info(`${signal} received, shutting down OpenTelemetry...`);
            await this.shutdown();
        };

        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGINT', () => handleShutdown('SIGINT'));

        // Handle unhandled rejections in observability setup
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled rejection in OpenTelemetry setup', {
                reason: reason instanceof Error ? reason.message : String(reason),
                promise: String(promise)
            });
        });
    }

    /**
     * Public Getters for External Access
     */
    public get isInitialised(): boolean {
        return this.initialized;
    }

    public get getSDK(): NodeSDK | null {
        return this.sdk;
    }

    public getStatus(): {
        initialized: boolean;
        tracingEnabled: boolean;
        metricsEnabled: boolean;
        features: string[];
    } {
        const features = [];
        if (this.traceExporter) features.push('tracing');
        if (this.metricReader) features.push('metrics');

        return {
            initialized: this.initialized,
            tracingEnabled: Boolean(this.traceExporter),
            metricsEnabled: Boolean(this.metricReader),
            features,
        };
    }
}

export default OpenTelemetryManager;