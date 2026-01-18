/**
 * Error Handler Utility
 * Centralized error handling and reporting
 */

const Logger = require('./Logger');

class ErrorHandler {
  constructor() {
    this.logger = Logger.getInstance();
    this.errorCounts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Static method for backward compatibility
  static handle(error, context = {}) {
    const instance = new ErrorHandler();
    return instance.handle(error, context);
  }

  static handleTelegramError(error, context = {}) {
    const instance = new ErrorHandler();
    return instance.handleTelegramError(error, context);
  }

  static handleTradingViewError(error, context = {}) {
    const instance = new ErrorHandler();
    return instance.handleTradingViewError(error, context);
  }

  /**
   * Handle application errors
   */
  handle(error, context = {}) {
    const errorId = this.generateErrorId();
    const errorInfo = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      ...context
    };

    // Log the error
    this.logger.info('Error occurred', {
      errorId: errorInfo.id,
      error: error.message,
      context: errorInfo
    });

    // Track error frequency
    this.trackError(error);

    // Determine if this is a critical error
    if (this.isCriticalError(error)) {
      this.handleCriticalError(error, errorInfo);
    }

    return errorInfo;
  }

  /**
   * Handle async operation errors with retry logic
   */
  async handleWithRetry(operation, options = {}) {
    const {
      maxRetries = this.maxRetries,
      retryDelay = this.retryDelay,
      operationName = 'operation',
      context = {}
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const errorInfo = this.handle(error, {
          ...context,
          operation: operationName,
          attempt,
          maxRetries
        });

        // Don't retry on the last attempt
        if (attempt <= maxRetries) {
          this.logger.warn(`Retrying ${operationName} (attempt ${attempt}/${maxRetries})`, {
            operation: operationName,
            attempt,
            delay: retryDelay
          });

          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    throw lastError;
  }

  /**
   * Handle Telegram bot errors
   */
  handleTelegramError(error, context = {}) {
    const errorType = this.categorizeTelegramError(error);

    const errorInfo = this.handle(error, {
      service: 'telegram',
      errorType,
      ...context
    });

    // Handle specific Telegram errors
    switch (errorType) {
      case 'rate_limit':
        this.handleRateLimit(error, context);
        break;
      case 'invalid_token':
        this.handleInvalidToken(error, context);
        break;
      case 'network':
        this.handleNetworkError(error, context);
        break;
    }

    return errorInfo;
  }

  /**
   * Handle TradingView API errors
   */
  handleTradingViewError(error, context = {}) {
    const errorType = this.categorizeApiError(error);

    const errorInfo = this.handle(error, {
      service: 'tradingview',
      errorType,
      ...context
    });

    // Handle specific API errors
    switch (errorType) {
      case 'rate_limit':
        this.handleApiRateLimit(error, context);
        break;
      case 'auth':
        this.handleApiAuthError(error, context);
        break;
      case 'network':
        this.handleNetworkError(error, context);
        break;
    }

    return errorInfo;
  }

  /**
   * Handle IQ Option errors
   */
  handleIQOptionError(error, context = {}) {
    const errorType = this.categorizeIQOptionError(error);

    const errorInfo = this.handle(error, {
      service: 'iqoption',
      errorType,
      ...context
    });

    // Handle specific IQ Option errors
    switch (errorType) {
      case 'login_failed':
        this.handleLoginError(error, context);
        break;
      case 'insufficient_balance':
        this.handleInsufficientBalance(error, context);
        break;
      case 'trade_rejected':
        this.handleTradeRejection(error, context);
        break;
    }

    return errorInfo;
  }

  /**
   * Handle database errors
   */
  handleDatabaseError(error, context = {}) {
    const errorType = this.categorizeDatabaseError(error);

    const errorInfo = this.handle(error, {
      service: 'database',
      errorType,
      ...context
    });

    // Handle specific database errors
    switch (errorType) {
      case 'connection':
        this.handleConnectionError(error, context);
        break;
      case 'constraint':
        this.handleConstraintError(error, context);
        break;
      case 'timeout':
        this.handleTimeoutError(error, context);
        break;
    }

    return errorInfo;
  }

  /**
   * Categorize different types of errors
   */
  categorizeTelegramError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit';
    }
    if (message.includes('unauthorized') || message.includes('invalid token')) {
      return 'invalid_token';
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
      return 'network';
    }
    if (message.includes('bad request') || message.includes('invalid')) {
      return 'bad_request';
    }

    return 'unknown';
  }

  categorizeApiError(error) {
    const message = error.message?.toLowerCase() || '';
    const status = error.response?.status;

    if (status === 429 || message.includes('rate limit')) {
      return 'rate_limit';
    }
    if (status === 401 || status === 403 || message.includes('unauthorized')) {
      return 'auth';
    }
    if (status >= 500 || message.includes('network') || message.includes('timeout')) {
      return 'network';
    }
    if (status >= 400) {
      return 'client_error';
    }

    return 'unknown';
  }

  categorizeIQOptionError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('login') || message.includes('authentication')) {
      return 'login_failed';
    }
    if (message.includes('balance') || message.includes('insufficient')) {
      return 'insufficient_balance';
    }
    if (message.includes('reject') || message.includes('not allowed')) {
      return 'trade_rejected';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'network';
    }

    return 'unknown';
  }

  categorizeDatabaseError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('connection') || message.includes('connect')) {
      return 'connection';
    }
    if (message.includes('constraint') || message.includes('foreign key') || message.includes('unique')) {
      return 'constraint';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('syntax') || message.includes('invalid')) {
      return 'syntax';
    }

    return 'unknown';
  }

  /**
   * Specific error handlers
   */
  handleCriticalError(error, context) {
    this.logger.error('CRITICAL ERROR - System may be unstable', {
      error: error.message,
      stack: error.stack,
      ...context
    });

    // Here you could send alerts, restart services, etc.
    // For now, just log it prominently
  }

  handleRateLimit(error, context) {
    const retryAfter = error.retry_after || 30;
    this.logger.warn(`Rate limit hit, retrying after ${retryAfter} seconds`, context);

    // Implement rate limit handling logic
  }

  handleInvalidToken(error, context) {
    this.logger.error('Invalid token detected', context);
    // Could trigger token refresh or alert admin
  }

  handleNetworkError(error, context) {
    this.logger.warn('Network error occurred', context);
    // Could implement circuit breaker pattern
  }

  handleApiRateLimit(error, context) {
    this.logger.warn('API rate limit exceeded', context);
    // Implement exponential backoff
  }

  handleApiAuthError(error, context) {
    this.logger.error('API authentication failed', context);
    // Could trigger re-authentication
  }

  handleLoginError(error, context) {
    this.logger.error('IQ Option login failed', context);
    // Could implement login retry logic
  }

  handleInsufficientBalance(error, context) {
    this.logger.warn('Insufficient balance for trade', context);
    // Could notify user or pause trading
  }

  handleTradeRejection(error, context) {
    this.logger.warn('Trade rejected by IQ Option', context);
    // Could analyze rejection reason and adjust strategy
  }

  handleConnectionError(error, context) {
    this.logger.error('Database connection error', context);
    // Could implement connection pooling or failover
  }

  handleConstraintError(error, context) {
    this.logger.warn('Database constraint violation', context);
    // Could validate data before insertion
  }

  handleTimeoutError(error, context) {
    this.logger.warn('Database timeout', context);
    // Could implement query optimization
  }

  /**
   * Check if error is critical
   */
  isCriticalError(error) {
    const criticalPatterns = [
      'out of memory',
      'stack overflow',
      'segmentation fault',
      'database connection lost',
      'authentication failed',
      'invalid token'
    ];

    const message = error.message?.toLowerCase() || '';
    return criticalPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Track error frequency
   */
  trackError(error) {
    const errorKey = `${error.name}:${error.message}`;
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);

    // Log if this error is occurring frequently
    if (count > 5) {
      this.logger.warn('Frequent error detected', {
        error: errorKey,
        count: count + 1
      });
    }
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create user-friendly error message
   */
  getUserFriendlyMessage(error, context = {}) {
    const errorType = context.errorType || 'unknown';

    const userMessages = {
      rate_limit: 'Too many requests. Please wait a moment and try again.',
      invalid_token: 'Authentication error. Please contact support.',
      network: 'Network connection issue. Please check your internet and try again.',
      insufficient_balance: 'Insufficient balance to execute this trade.',
      login_failed: 'Login failed. Please check your credentials.',
      trade_rejected: 'Trade was rejected. Please try again or contact support.',
      database: 'Database error. Please try again later.',
      timeout: 'Request timed out. Please try again.',
      unknown: 'An unexpected error occurred. Please try again or contact support.'
    };

    return userMessages[errorType] || userMessages.unknown;
  }

  /**
   * Delay utility for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      errorTypes: {},
      frequentErrors: []
    };

    for (const [errorKey, count] of this.errorCounts.entries()) {
      stats.totalErrors += count;
      stats.errorTypes[errorKey] = count;

      if (count > 3) {
        stats.frequentErrors.push({ error: errorKey, count });
      }
    }

    stats.frequentErrors.sort((a, b) => b.count - a.count);

    return stats;
  }

  /**
   * Reset error tracking
   */
  resetErrorStats() {
    this.errorCounts.clear();
    this.logger.info('Error statistics reset');
  }
}

module.exports = ErrorHandler;