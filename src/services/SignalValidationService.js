/**
 * Signal Validation Service
 * Tracks and validates trading signals after execution
 */

const Logger = require('../utils/Logger');

class SignalValidationService {
  constructor(database, bot = null, analysisService = null) {
    this.database = database;
    this.bot = bot; // Telegram bot for sending notifications
    this.analysisService = analysisService; // For getting current price
    this.logger = Logger.getInstance();
    this.activeSignals = new Map(); // Track active signals: signalId -> { symbol, direction, entryPrice, timeframe, timestamp, validationTimer }
    this.validationTimers = new Map(); // Track setTimeout timers for validation
  }

  /**
   * Convert timeframe string to milliseconds
   */
  timeframeToMs(timeframe) {
    const timeframeMap = {
      '5s': 5 * 1000,
      '15s': 15 * 1000,
      '30s': 30 * 1000,
      '1m': 60 * 1000,
      '2m': 2 * 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '10m': 10 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1H': 60 * 60 * 1000,
      '4H': 4 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000
    };
    
    return timeframeMap[timeframe] || 5 * 60 * 1000; // Default to 5 minutes
  }

  /**
   * Register a signal for validation and schedule automatic validation
   */
  registerSignal(signalId, signalData) {
    const signal = {
      signalId,
      symbol: signalData.symbol,
      assetType: signalData.assetType,
      direction: signalData.direction, // 'CALL' or 'PUT'
      entryPrice: signalData.entryPrice,
      timeframe: signalData.timeframe,
      confidence: signalData.confidence,
      timestamp: new Date(),
      userId: signalData.userId
    };

    this.activeSignals.set(signalId, signal);
    
    // Schedule automatic validation after timeframe expires
    const timeframeMs = this.timeframeToMs(signalData.timeframe || '5m');
    const validationTimer = setTimeout(async () => {
      await this.autoValidateSignal(signalId);
    }, timeframeMs);
    
    this.validationTimers.set(signalId, validationTimer);
    
    this.logger.info('Signal registered for validation', { 
      signalId, 
      symbol: signal.symbol, 
      direction: signal.direction,
      timeframe: signal.timeframe,
      validationIn: `${timeframeMs / 1000} seconds`
    });
    
    return signal;
  }

  /**
   * Automatically validate signal after timeframe expires
   */
  async autoValidateSignal(signalId) {
    try {
      const signal = this.activeSignals.get(signalId);
      if (!signal) {
        this.logger.warn('Signal not found for auto-validation', { signalId });
        return;
      }

      // Get current price using analysis service
      let exitPrice = signal.entryPrice; // Fallback to entry price
      
      if (this.analysisService) {
        try {
          const marketData = await this.analysisService.getMarketData(
            signal.symbol, 
            signal.assetType, 
            signal.timeframe || '1H'
          );
          
          // Try multiple ways to extract price
          if (marketData) {
            if (marketData.current_price) {
              exitPrice = parseFloat(marketData.current_price);
            } else if (marketData.price_data && marketData.price_data.price) {
              exitPrice = parseFloat(marketData.price_data.price);
            } else if (marketData.price_data && marketData.price_data.current) {
              exitPrice = parseFloat(marketData.price_data.current);
            } else if (marketData.price) {
              exitPrice = parseFloat(marketData.price);
            } else if (marketData.closes && marketData.closes.length > 0) {
              // Use last close price from candle data
              exitPrice = parseFloat(marketData.closes[marketData.closes.length - 1]);
            }
          }
          
          // Validate exit price is a valid number
          if (!exitPrice || isNaN(exitPrice) || exitPrice === 0) {
            this.logger.warn('Invalid exit price extracted', { signalId, exitPrice, marketData });
            exitPrice = signal.entryPrice; // Fallback to entry price
          }
        } catch (error) {
          this.logger.warn('Failed to get current price for validation', { 
            signalId, 
            symbol: signal.symbol, 
            error: error.message 
          });
        }
      }

      // Validate the signal
      const validationResult = await this.validateSignal(signalId, exitPrice);

      // Send notification to user if bot is available
      if (validationResult && this.bot && signal.userId) {
        const message = this.formatValidationMessage(validationResult);
        await this.bot.telegram.sendMessage(signal.userId, message);
      }

      // Clean up timer
      this.validationTimers.delete(signalId);

    } catch (error) {
      this.logger.error('Error in auto-validation', { signalId, error: error.message });
    }
  }

  /**
   * Validate signal after expiry
   */
  async validateSignal(signalId, exitPrice, result = null) {
    const signal = this.activeSignals.get(signalId);
    if (!signal) {
      this.logger.warn('Signal not found for validation', { signalId });
      return null;
    }

    // Ensure entryPrice is valid (not 0)
    if (!signal.entryPrice || signal.entryPrice === 0) {
      this.logger.warn('Invalid entry price for signal validation', { signalId, entryPrice: signal.entryPrice });
      // Try to skip validation if entry price is invalid
      return null;
    }

    const priceChange = exitPrice - signal.entryPrice;
    let priceChangePercent = '0.00';
    
    // Prevent division by zero
    if (signal.entryPrice && signal.entryPrice !== 0) {
      priceChangePercent = ((priceChange / signal.entryPrice) * 100).toFixed(2);
    } else {
      this.logger.warn('Cannot calculate price change percent - entry price is zero', { signalId });
    }

    let validationResult;
    
    if (result) {
      // If result is provided (win/loss), use it
      validationResult = {
        signalId,
        symbol: signal.symbol,
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        exitPrice,
        priceChange,
        priceChangePercent,
        result, // 'win' or 'loss'
        validated: true,
        validatedAt: new Date()
      };
    } else {
      // Auto-determine result based on direction and price change
      let isWin = false;
      if (signal.direction === 'CALL' && priceChange > 0) {
        isWin = true;
      } else if (signal.direction === 'PUT' && priceChange < 0) {
        isWin = true;
      }

      validationResult = {
        signalId,
        symbol: signal.symbol,
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        exitPrice,
        priceChange,
        priceChangePercent,
        result: isWin ? 'win' : 'loss',
        validated: true,
        validatedAt: new Date()
      };
    }

    // Save to database if available
    if (this.database) {
      await this.saveValidationToDatabase(validationResult);
    }

    // Remove from active signals
    this.activeSignals.delete(signalId);

    this.logger.info('Signal validated', {
      signalId,
      symbol: signal.symbol,
      result: validationResult.result,
      priceChangePercent
    });

    return validationResult;
  }

  /**
   * Get signal status
   */
  getSignalStatus(signalId) {
    return this.activeSignals.get(signalId) || null;
  }

  /**
   * Get all active signals
   */
  getActiveSignals() {
    return Array.from(this.activeSignals.values());
  }

  /**
   * Get active signals for user
   */
  getUserActiveSignals(userId) {
    return Array.from(this.activeSignals.values()).filter(s => s.userId === userId);
  }

  /**
   * Format validation result message
   */
  formatValidationMessage(validationResult) {
    const { symbol, direction, entryPrice, exitPrice, priceChange, priceChangePercent, result } = validationResult;
    
    const emoji = result === 'win' ? '✅' : '❌';
    const status = result === 'win' ? 'WIN' : 'LOSS';
    const profitLoss = result === 'win' ? 'Profit' : 'Loss';

    return `${emoji} Signal ${status} - ${symbol}

Direction: ${direction === 'CALL' ? '🔼 CALL (UP)' : '🔽 PUT (DOWN)'}
Entry Price: $${entryPrice.toFixed(4)}
Exit Price: $${exitPrice.toFixed(4)}
${profitLoss}: ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent}%

Status: ${result === 'win' ? '✅ Signal was CORRECT' : '❌ Signal was INCORRECT'}`;
  }

  /**
   * Save validation to database
   */
  async saveValidationToDatabase(validationResult) {
    try {
      if (!this.database) return;

      const Signal = this.database.getModel('Signal');
      if (!Signal) return;

      const signal = await Signal.findByPk(validationResult.signalId);
      if (signal) {
        await signal.update({
          result: validationResult.result,
          exit_price: validationResult.exitPrice,
          validated_at: validationResult.validatedAt,
          status: 'validated'
        });

        this.logger.info('Signal validation saved to database', { signalId: validationResult.signalId });
      }
    } catch (error) {
      this.logger.error('Error saving signal validation', { error: error.message });
    }
  }

  /**
   * Clean up expired signals
   */
  cleanupExpiredSignals() {
    const now = Date.now();
    const expiredThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [signalId, signal] of this.activeSignals.entries()) {
      const age = now - signal.timestamp.getTime();
      if (age > expiredThreshold) {
        this.activeSignals.delete(signalId);
        this.logger.info('Expired signal removed', { signalId, age: age / 1000 / 60 });
      }
    }
  }

  /**
   * Get validation statistics
   */
  async getValidationStats(userId = null) {
    try {
      if (!this.database) {
        return {
          total: 0,
          wins: 0,
          losses: 0,
          winRate: 0
        };
      }

      const Signal = this.database.getModel('Signal');
      if (!Signal) return null;

      const where = {
        status: 'validated',
        result: ['win', 'loss']
      };

      if (userId) {
        where.user_id = userId;
      }

      const [total, wins, losses] = await Promise.all([
        Signal.count({ where }),
        Signal.count({ where: { ...where, result: 'win' } }),
        Signal.count({ where: { ...where, result: 'loss' } })
      ]);

      const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : 0;

      return {
        total,
        wins,
        losses,
        winRate: parseFloat(winRate)
      };
    } catch (error) {
      this.logger.error('Error getting validation stats', { error: error.message });
      return null;
    }
  }
}

module.exports = SignalValidationService;
