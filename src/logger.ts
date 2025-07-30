import pino from 'pino';

/**
 * Logger configuration
 */
const loggerConfig = {
  level: 'info',
  base: {
    service: 'health-factor-monitor',
    environment: 'production',
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

/**
 * Create a logger instance
 */
export const logger = pino.default(loggerConfig);

/**
 * Log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Enhanced logger with context support
 */
export class ContextLogger {
  private context: Record<string, unknown>;
  
  constructor(private baseLogger: pino.Logger, context: Record<string, unknown> = {}) {
    this.context = context;
  }
  
  /**
   * Create a child logger with additional context
   */
  withContext(context: Record<string, unknown>): ContextLogger {
    return new ContextLogger(this.baseLogger, { ...this.context, ...context });
  }
  
  /**
   * Log a message at the specified level
   */
  log(level: LogLevel, message: string, data: Record<string, unknown> = {}): void {
    this.baseLogger[level]({ ...this.context, ...data }, message);
  }
  
  /**
   * Log a message at trace level
   */
  trace(message: string, data: Record<string, unknown> = {}): void {
    this.log('trace', message, data);
  }
  
  /**
   * Log a message at debug level
   */
  debug(message: string, data: Record<string, unknown> = {}): void {
    this.log('debug', message, data);
  }
  
  /**
   * Log a message at info level
   */
  info(message: string, data: Record<string, unknown> = {}): void {
    this.log('info', message, data);
  }
  
  /**
   * Log a message at warn level
   */
  warn(message: string, data: Record<string, unknown> = {}): void {
    this.log('warn', message, data);
  }
  
  /**
   * Log a message at error level
   */
  error(message: string, data: Record<string, unknown> = {}): void {
    this.log('error', message, data);
  }
  
  /**
   * Log a message at fatal level
   */
  fatal(message: string, data: Record<string, unknown> = {}): void {
    this.log('fatal', message, data);
  }
}

/**
 * Create the root logger
 */
export const rootLogger = new ContextLogger(logger);
