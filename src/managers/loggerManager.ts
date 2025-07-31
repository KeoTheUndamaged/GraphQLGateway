/**
 * Winston Logger Configuration
 *
 * Provides structured logging with different levels for development and production.
 * Integrates with HTTP request logging via Morgan.
 *
 * Log Levels (in order of severity):
 * - error: 0 - Critical errors requiring immediate attention
 * - warn: 1 - Warning conditions that should be addressed
 * - info: 2 - General informational messages
 * - http: 3 - HTTP request/response logging
 * - debug: 4 - Detailed debugging information
 */
import winston from 'winston';

export interface Logger {
    error: (message: string, metadata?: {}) => winston.Logger;
    warn: (message: string, metadata?: {}) => winston.Logger;
    info: (message: string, metadata?: {}) => winston.Logger;
    http: (message: string, metadata?: {}) => winston.Logger;
    debug: (message: string, metadata?: {}) => winston.Logger;
    stream: { write: (message: string) => winston.Logger }
}

class LoggerManager {
    private readonly level: string;
    private readonly levels: any;
    private readonly format: winston.Logform.Format;
    private readonly transports: winston.transport[];
    private readonly logger: winston.Logger;

    constructor(level: string) {
        // Custom log levels optimised for API services
        this.levels = {
            error: 0, // Critical errors
            warn: 1, // Warnings
            info: 2, // General info
            http: 3, // HTTP requests
            debug: 4, // Debug info
        }
        this.level = level;

        // Structured JSON logging format for production log aggregation
        this.format = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }), // Include stack traces for errors
            winston.format.splat(), // Support string interpolation
            winston.format.json(), // JSON format for log aggregators
            winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
        );

        this.transports = [
            new winston.transports.Console({
                level: this.level,
                format: this.format,
            }),
        ];

        this.logger = winston.createLogger({
            level: this.level,
            levels: this.levels,
            format: this.format,
            transports: this.transports,
            exitOnError: false, // Don't exit on handled exceptions
        });
    }

    public getLoggerInterfaces() {
        return {
            // Wrap metadata in a consistent structure for log parsing
            error: (message: string, metadata = {}) => this.logger.error(message, { metadata }),
            warn: (message: string, metadata = {}) => this.logger.warn(message, { metadata }),
            info: (message: string, metadata = {}) => this.logger.info(message, { metadata }),
            http: (message: string, metadata = {}) => this.logger.http(message, { metadata }),
            debug: (message: string, metadata = {}) => this.logger.debug(message, { metadata }),

            // Stream interface for Morgan HTTP logging integration
            stream: {
                write: (message: string) => this.logger.http(message.trim()),
            },
        }
    }
}

/**
 * Factory function to create logger instances with specific log levels
 * @param level - Winston log level (error, warn, info, http, debug)
 * @returns Logger interface with structured logging methods
 */
export const createLogger = (level: string) => new LoggerManager(level).getLoggerInterfaces();