/**
 * Logger Utility
 * Centralized logging system using Winston
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

class Logger {
  constructor() {
    this.logger = null;
    this.initialized = false;
  }

  /**
   * Initialize the logger
   */
  initialize(options = {}) {
    if (this.initialized) return;

    const logLevel = process.env.LOG_LEVEL || options.level || 'info';
    const logDir = options.logDir || path.join(__dirname, '../../logs');

    // Ensure log directory exists
    fs.ensureDirSync(logDir);

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        // Add metadata if present
        if (Object.keys(meta).length > 0) {
          // Remove winston-specific fields
          const cleanMeta = { ...meta };
          delete cleanMeta.level;
          delete cleanMeta.message;
          delete cleanMeta.timestamp;
          delete cleanMeta.splat;

          if (Object.keys(cleanMeta).length > 0) {
            // Safe JSON stringify to handle circular references
            try {
              const seen = new WeakSet();
              const safeStringify = (obj) => {
                return JSON.stringify(obj, (key, value) => {
                  // Skip circular references
                  if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                      return '[Circular]';
                    }
                    seen.add(value);
                  }
                  // Skip functions and undefined
                  if (typeof value === 'function' || value === undefined) {
                    return '[Function]';
                  }
                  return value;
                });
              };
              logMessage += ` | ${safeStringify(cleanMeta)}`;
            } catch (err) {
              // If stringify still fails, use a simple string representation
              logMessage += ` | ${JSON.stringify({ error: String(cleanMeta.error || 'Unknown error') })}`;
            }
          }
        }

        return logMessage;
      })
    );

    // Define transports
    const transports = [
      // Console transport for development
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat
        ),
        handleExceptions: true,
        handleRejections: true
      }),

      // File transport for all logs
      new winston.transports.File({
        filename: path.join(logDir, 'bot.log'),
        level: 'info',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      }),

      // Separate file for errors
      new winston.transports.File({
        filename: path.join(logDir, 'errors.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      }),

      // Separate file for trades
      new winston.transports.File({
        filename: path.join(logDir, 'trades.log'),
        level: 'info',
        format: winston.format.combine(
          winston.format((info) => {
            if (info.trade || info.signal) {
              return info;
            }
            return false;
          })(),
          logFormat
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        tailable: true
      }),

      // Performance logs
      new winston.transports.File({
        filename: path.join(logDir, 'performance.log'),
        level: 'info',
        format: winston.format.combine(
          winston.format((info) => {
            if (info.performance || info.stats) {
              return info;
            }
            return false;
          })(),
          logFormat
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      })
    ];

    // Create logger instance
    this.logger = winston.createLogger({
      level: logLevel,
      format: logFormat,
      transports,
      exitOnError: false
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({
        filename: path.join(logDir, 'exceptions.log'),
        format: logFormat
      })
    );

    this.logger.rejections.handle(
      new winston.transports.File({
        filename: path.join(logDir, 'rejections.log'),
        format: logFormat
      })
    );

    this.initialized = true;

    // Log initialization
    this.info('Logger initialized', {
      level: logLevel,
      logDir,
      transports: transports.length
    });
  }

  /**
   * Get logger instance (singleton pattern)
   */
  static getInstance() {
    if (!Logger.instance) {
      Logger.instance = new Logger();
      Logger.instance.initialize();
    }
    return Logger.instance.logger;
  }

  /**
   * Log methods for different levels
   */
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * Trade-specific logging
   */
  logTrade(action, tradeData) {
    const message = `TRADE ${action.toUpperCase()}`;
    this.logger.info(message, { trade: true, ...tradeData });
  }

  /**
   * Signal-specific logging
   */
  logSignal(action, signalData) {
    const message = `SIGNAL ${action.toUpperCase()}`;
    this.logger.info(message, { signal: true, ...signalData });
  }

  /**
   * Performance logging
   */
  logPerformance(action, performanceData) {
    const message = `PERFORMANCE ${action.toUpperCase()}`;
    this.logger.info(message, { performance: true, ...performanceData });
  }

  /**
   * Error logging with stack trace
   */
  logError(error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      ...context
    };

    this.logger.error('Application Error', errorData);
  }

  /**
   * User action logging
   */
  logUserAction(userId, action, details = {}) {
    this.logger.info(`USER ACTION: ${action}`, {
      userId,
      action,
      ...details
    });
  }

  /**
   * Bot command logging
   */
  logCommand(userId, command, args = {}, response = {}) {
    this.logger.info(`COMMAND: ${command}`, {
      userId,
      command,
      args,
      response: typeof response === 'string' ? response.substring(0, 200) : response
    });
  }

  /**
   * API call logging
   */
  logApiCall(service, endpoint, method = 'GET', status = null, duration = null, error = null) {
    const level = error ? 'error' : status >= 400 ? 'warn' : 'debug';
    const message = `API ${method} ${service}:${endpoint}`;

    const meta = {
      service,
      endpoint,
      method,
      status,
      duration: duration ? `${duration}ms` : null
    };

    if (error) {
      meta.error = error.message;
    }

    this.logger.log(level, message, meta);
  }

  /**
   * Database operation logging
   */
  logDatabase(operation, table, conditions = {}, result = {}, error = null) {
    const level = error ? 'error' : 'debug';
    const message = `DB ${operation.toUpperCase()}: ${table}`;

    const meta = {
      operation,
      table,
      conditions,
      result: error ? null : result
    };

    if (error) {
      meta.error = error.message;
    }

    this.logger.log(level, message, meta);
  }

  /**
   * TradingView API logging
   */
  logTradingView(action, symbol = null, data = {}) {
    this.logger.info(`TRADINGVIEW ${action.toUpperCase()}`, {
      symbol,
      ...data
    });
  }

  /**
   * IQ Option logging
   */
  logIQOption(action, details = {}) {
    this.logger.info(`IQOPTION ${action.toUpperCase()}`, details);
  }

  /**
   * Indicator calculation logging
   */
  logIndicator(symbol, indicator, value, signal = null) {
    this.logger.debug(`INDICATOR: ${indicator}`, {
      symbol,
      indicator,
      value,
      signal
    });
  }

  /**
   * Signal generation logging
   */
  logSignalGeneration(symbol, signal, confidence, indicators = {}) {
    this.logger.info(`SIGNAL GENERATED: ${signal}`, {
      symbol,
      signal,
      confidence,
      indicators: Object.keys(indicators)
    });
  }

  /**
   * Risk management logging
   */
  logRiskCheck(userId, checkType, result, details = {}) {
    const level = result === 'passed' ? 'debug' : 'warn';
    this.logger.log(level, `RISK CHECK: ${checkType}`, {
      userId,
      checkType,
      result,
      ...details
    });
  }

  /**
   * Notification logging
   */
  logNotification(userId, type, channel = 'telegram', success = true, error = null) {
    const level = success ? 'info' : 'error';
    const message = `NOTIFICATION ${success ? 'SENT' : 'FAILED'}: ${type}`;

    this.logger.log(level, message, {
      userId,
      type,
      channel,
      success,
      error: error ? error.message : null
    });
  }

  /**
   * Performance metrics logging
   */
  logMetrics(metrics = {}) {
    this.logger.info('PERFORMANCE METRICS', {
      stats: true,
      ...metrics
    });
  }

  /**
   * System health logging
   */
  logHealthCheck(component, status, details = {}) {
    const level = status === 'healthy' ? 'info' : 'error';
    this.logger.log(level, `HEALTH CHECK: ${component}`, {
      component,
      status,
      ...details
    });
  }

  /**
   * Create child logger for specific context
   */
  child(defaultMeta = {}) {
    return this.logger.child(defaultMeta);
  }

  /**
   * Flush all logs (useful for graceful shutdown)
   */
  async flush() {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  /**
   * Query logs (basic implementation)
   */
  query(options = {}) {
    // This is a basic implementation
    // In production, you might want to use a log aggregation service
    const { level, limit = 100, startTime, endTime } = options;

    // For now, just return a placeholder
    // Real implementation would query log files
    return {
      logs: [],
      total: 0,
      message: 'Log querying not implemented in basic version'
    };
  }

  /**
   * Get logger statistics
   */
  getStats() {
    // Basic stats - could be enhanced
    return {
      initialized: this.initialized,
      level: this.logger ? this.logger.level : null,
      transports: this.logger ? this.logger.transports.length : 0
    };
  }
}

// Export singleton instance
module.exports = Logger;