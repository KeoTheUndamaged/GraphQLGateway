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
import {serverConfig} from './environmentVariables';

class Logger {
    private readonly logLevel: string;
    private readonly levels: any;
    private readonly logFormat: winston.Logform.Format;
    private readonly transports: winston.transport[];
    private readonly logger: winston.Logger;

    constructor(logLevel: string = serverConfig.logLevel) {
        // Custom log levels optimised for API services
        this.levels = {
            error: 0, // Critical errors
            warn: 1, // Warnings
            info: 2, // General info
            http: 3, // HTTP requests
            debug: 4, // Debug info
        }
        this.logLevel = logLevel;

        // Structured JSON logging format for production log aggregation
        this.logFormat = winston.format.combine(
            winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
            winston.format.errors({stack: true}), // Include stack traces for errors
            winston.format.splat(), // Support string interpolation
            winston.format.json(), // JSON format for log aggregators
            winston.format.metadata({fillExcept: ['message', 'level', 'timestamp', 'label']}),
        );

        this.transports = [
            new winston.transports.Console(),
        ];

        this.logger = winston.createLogger({
            levels: this.levels,
            level: this.logLevel,
            format: this.logFormat,
            transports: this.transports,
            exitOnError: false, // Don't exit on handled exceptions
        })
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
 * @param logLevel - Winston log level (error, warn, info, http, debug)
 * @returns Logger interface with structured logging methods
 */
export const createLogger = (logLevel: string) => new Logger(logLevel).getLoggerInterfaces();