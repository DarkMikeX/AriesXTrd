/**
 * Validator Utility
 * Input validation and data sanitization
 */

class Validator {
  /**
   * Validate email address
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate Telegram username
   */
  static isValidTelegramUsername(username) {
    if (!username) return false;
    if (typeof username !== 'string') return false;

    // Telegram usernames: 5-32 characters, alphanumeric, underscores, no spaces
    const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
    return usernameRegex.test(username);
  }

  /**
   * Validate asset symbol
   */
  static isValidAssetSymbol(symbol, type = 'stock') {
    if (!symbol || typeof symbol !== 'string') return false;

    const upperSymbol = symbol.toUpperCase();

    // Different validation rules for different asset types
    switch (type) {
      case 'stock':
        return /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(upperSymbol); // e.g., AAPL, TSLA, BRK.A
      case 'forex':
        return /^[A-Z]{6}$/.test(upperSymbol); // e.g., EURUSD
      case 'crypto':
        return /^[A-Z]{2,10}$/.test(upperSymbol); // e.g., BTC, ETH
      case 'commodity':
        return /^[A-Z]{1,4}$/.test(upperSymbol); // e.g., XAU, XAG
      default:
        return /^[A-Z0-9]{1,10}$/.test(upperSymbol);
    }
  }

  /**
   * Validate trade amount
   */
  static isValidTradeAmount(amount, minAmount = 1, maxAmount = 1000) {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= minAmount && num <= maxAmount;
  }

  /**
   * Validate trade duration
   */
  static isValidTradeDuration(duration, allowedDurations = [1, 2, 5, 15, 30, 60]) {
    const num = parseInt(duration);
    return allowedDurations.includes(num);
  }

  /**
   * Validate confidence score
   */
  static isValidConfidence(confidence) {
    const num = parseFloat(confidence);
    return !isNaN(num) && num >= 0 && num <= 100;
  }

  /**
   * Validate price value
   */
  static isValidPrice(price) {
    const num = parseFloat(price);
    return !isNaN(num) && num > 0 && num < 1000000; // Reasonable price range
  }

  /**
   * Validate percentage value
   */
  static isValidPercentage(percentage) {
    const num = parseFloat(percentage);
    return !isNaN(num) && num >= 0 && num <= 100;
  }

  /**
   * Validate indicator value
   */
  static isValidIndicatorValue(indicator, value) {
    const num = parseFloat(value);

    if (isNaN(num)) return false;

    switch (indicator.toLowerCase()) {
      case 'rsi':
        return num >= 0 && num <= 100;
      case 'macd':
        return num >= -1000 && num <= 1000; // Reasonable MACD range
      case 'stochastic':
        return num >= 0 && num <= 100;
      case 'volume':
        return num >= 0;
      default:
        return num >= -1000000 && num <= 1000000; // General range
    }
  }

  /**
   * Validate IQ Option credentials format
   */
  static isValidIQOptionCredentials(email, password) {
    return this.isValidEmail(email) &&
           password &&
           typeof password === 'string' &&
           password.length >= 6;
  }

  /**
   * Validate TradingView API key format
   */
  static isValidTradingViewApiKey(apiKey) {
    // TradingView API keys are typically 32-64 character alphanumeric strings
    return apiKey &&
           typeof apiKey === 'string' &&
           /^[a-zA-Z0-9]{32,64}$/.test(apiKey);
  }

  /**
   * Validate Telegram bot token format
   */
  static isValidTelegramBotToken(token) {
    // Telegram bot tokens follow the format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
    return token &&
           typeof token === 'string' &&
           /^\d+:[a-zA-Z0-9_-]{35,}$/.test(token);
  }

  /**
   * Validate date string
   */
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Validate JSON string
   */
  static isValidJSON(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate array length
   */
  static isValidArrayLength(array, minLength = 0, maxLength = Infinity) {
    return Array.isArray(array) &&
           array.length >= minLength &&
           array.length <= maxLength;
  }

  /**
   * Validate object structure
   */
  static validateObjectStructure(obj, requiredFields) {
    if (!obj || typeof obj !== 'object') return false;

    return requiredFields.every(field => {
      return obj.hasOwnProperty(field) && obj[field] !== null && obj[field] !== undefined;
    });
  }

  /**
   * Validate trade parameters
   */
  static validateTradeParameters(params) {
    const required = ['asset_symbol', 'direction', 'amount', 'duration'];
    const structureValid = this.validateObjectStructure(params, required);

    if (!structureValid) return false;

    return this.isValidAssetSymbol(params.asset_symbol) &&
           ['CALL', 'PUT'].includes(params.direction) &&
           this.isValidTradeAmount(params.amount) &&
           this.isValidTradeDuration(params.duration);
  }

  /**
   * Validate signal data
   */
  static validateSignalData(signalData) {
    const required = ['asset_symbol', 'signal_type', 'confidence_score'];
    const structureValid = this.validateObjectStructure(signalData, required);

    if (!structureValid) return false;

    return this.isValidAssetSymbol(signalData.asset_symbol) &&
           ['BUY', 'SELL', 'HOLD', 'WAIT'].includes(signalData.signal_type) &&
           this.isValidConfidence(signalData.confidence_score);
  }

  /**
   * Validate indicator data
   */
  static validateIndicatorData(indicatorData) {
    if (!indicatorData || typeof indicatorData !== 'object') return false;

    const requiredIndicators = ['rsi', 'macd', 'bollinger_bands'];
    const hasRequired = requiredIndicators.some(indicator =>
      indicatorData.hasOwnProperty(indicator) &&
      this.isValidIndicatorValue(indicator, indicatorData[indicator])
    );

    return hasRequired;
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input, maxLength = 255) {
    if (!input || typeof input !== 'string') return '';

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, maxLength);
  }

  /**
   * Sanitize number input
   */
  static sanitizeNumber(input, min = -Infinity, max = Infinity, defaultValue = 0) {
    const num = parseFloat(input);

    if (isNaN(num)) return defaultValue;

    return Math.max(min, Math.min(max, num));
  }

  /**
   * Sanitize email
   */
  static sanitizeEmail(email) {
    if (!email || typeof email !== 'string') return '';

    return email.trim().toLowerCase();
  }

  /**
   * Sanitize asset symbol
   */
  static sanitizeAssetSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return '';

    return symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '').substring(0, 10);
  }

  /**
   * Validate and sanitize user input for Telegram commands
   */
  static validateTelegramCommand(command, args = []) {
    const validCommands = [
      'start', 'help', 'analyze', 'stats', 'balance',
      'history', 'settings', 'stop'
    ];

    if (!validCommands.includes(command)) {
      return { valid: false, error: 'Invalid command' };
    }

    // Validate command-specific arguments
    switch (command) {
      case 'analyze':
        if (args.length === 0) {
          return { valid: false, error: 'Asset symbol required' };
        }
        if (!this.isValidAssetSymbol(args[0])) {
          return { valid: false, error: 'Invalid asset symbol' };
        }
        break;

      case 'settings':
        // Settings command might have sub-commands
        break;
    }

    return { valid: true, sanitizedArgs: args.map(arg => this.sanitizeString(arg)) };
  }

  /**
   * Validate callback query data
   */
  static validateCallbackData(data) {
    if (!data || typeof data !== 'string') return false;

    // Callback data should be in format: action_param or just action
    const parts = data.split('_');
    const action = parts[0];

    const validActions = [
      'menu', 'trade', 'analyze', 'view', 'cancel',
      'confirm', 'settings', 'back', 'help'
    ];

    return validActions.includes(action);
  }

  /**
   * Validate file upload
   */
  static validateFileUpload(file, allowedTypes = [], maxSize = 5242880) { // 5MB default
    if (!file) return { valid: false, error: 'No file provided' };

    if (file.size > maxSize) {
      return { valid: false, error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` };
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      return { valid: false, error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` };
    }

    return { valid: true };
  }

  /**
   * Validate configuration object
   */
  static validateConfiguration(config) {
    const errors = [];

    // Check required fields
    if (!config.telegram?.botToken) {
      errors.push('Telegram bot token is required');
    } else if (!this.isValidTelegramBotToken(config.telegram.botToken)) {
      errors.push('Invalid Telegram bot token format');
    }

    if (config.iqoption?.enabled) {
      if (!this.isValidIQOptionCredentials(config.iqoption.email, config.iqoption.password)) {
        errors.push('Invalid IQ Option credentials');
      }
    }

    if (config.tradingview?.enabled) {
      if (!this.isValidTradingViewApiKey(config.tradingview.apiKey)) {
        errors.push('Invalid TradingView API key format');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate risk management parameters
   */
  static validateRiskParameters(params) {
    const errors = [];

    if (params.dailyLossLimit && params.dailyLossLimit < 0) {
      errors.push('Daily loss limit cannot be negative');
    }

    if (params.maxConsecutiveLosses && params.maxConsecutiveLosses < 1) {
      errors.push('Max consecutive losses must be at least 1');
    }

    if (params.minConfidenceThreshold &&
        (params.minConfidenceThreshold < 0 || params.minConfidenceThreshold > 100)) {
      errors.push('Confidence threshold must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate validation error message
   */
  static createValidationError(field, value, reason) {
    return {
      field,
      value,
      reason,
      message: `${field}: ${reason}`
    };
  }

  /**
   * Batch validate multiple fields
   */
  static validateFields(fields) {
    const results = {
      valid: true,
      errors: [],
      sanitized: {}
    };

    for (const [field, config] of Object.entries(fields)) {
      const { value, validator, sanitizer, required = false } = config;

      if (required && (value === null || value === undefined || value === '')) {
        results.valid = false;
        results.errors.push(this.createValidationError(field, value, 'Field is required'));
        continue;
      }

      if (value !== null && value !== undefined && value !== '') {
        // Apply sanitizer if provided
        let sanitizedValue = value;
        if (sanitizer && typeof sanitizer === 'function') {
          sanitizedValue = sanitizer(value);
        }

        // Apply validator if provided
        if (validator && typeof validator === 'function') {
          const isValid = validator(sanitizedValue);
          if (!isValid) {
            results.valid = false;
            results.errors.push(this.createValidationError(field, value, 'Validation failed'));
            continue;
          }
        }

        results.sanitized[field] = sanitizedValue;
      }
    }

    return results;
  }
}

module.exports = Validator;