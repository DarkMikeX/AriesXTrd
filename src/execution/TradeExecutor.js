/**
 * Trade Executor
 * Coordinates trade execution across all systems
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');

class TradeExecutor {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
    this.isInitialized = false;
  }

  /**
   * Initialize trade executor
   */
  async initialize() {
    try {
      this.isInitialized = true;
      this.logger.info('✅ Trade executor initialized');
    } catch (error) {
      this.logger.error('Failed to initialize trade executor', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute trade with full workflow
   */
  async executeTrade(tradeRequest) {
    const {
      userId,
      asset,
      direction,
      amount,
      expiryMinutes = 5,
      signalData = null
    } = tradeRequest;

    try {
      this.logger.info('Starting trade execution', {
        userId,
        asset,
        direction,
        amount
      });

      // 1. Validate trade request
      await this.validateTradeRequest(tradeRequest);

      // 2. Check risk management
      await this.checkRiskLimits(userId, amount);

      // 3. Get current market conditions
      const marketData = await this.getMarketData(asset);

      // 4. Execute trade on IQ Option
      const executionResult = await this.executeOnIQOption({
        userId,
        asset,
        direction,
        amount,
        expiryMinutes,
        marketData
      });

      if (!executionResult.success) {
        throw new Error(`Trade execution failed: ${executionResult.error}`);
      }

      // 5. Save trade to database
      const tradeRecord = await this.saveTradeRecord({
        userId,
        asset,
        direction,
        amount,
        expiryMinutes,
        executionResult,
        signalData
      });

      // 6. Start position monitoring
      await this.startPositionMonitoring(tradeRecord);

      // 7. Send confirmation notification
      await this.sendTradeConfirmation(userId, tradeRecord);

      // 8. Update user statistics
      await this.updateUserStats(userId, tradeRecord);

      this.logger.info('Trade execution completed successfully', {
        tradeId: tradeRecord.id,
        userId,
        asset
      });

      return {
        success: true,
        trade: tradeRecord,
        executionResult
      };

    } catch (error) {
      this.logger.error('Trade execution failed', {
        userId,
        asset,
        direction,
        error: error.message
      });

      // Send failure notification
      await this.sendTradeFailureNotification(userId, {
        asset,
        direction,
        amount,
        error: error.message
      });

      throw ErrorHandler.handle(error, {
        service: 'trade_executor',
        operation: 'execute_trade',
        userId,
        asset
      });
    }
  }

  /**
   * Validate trade request
   */
  async validateTradeRequest(request) {
    const errors = [];

    // Check required fields
    if (!request.userId) errors.push('User ID required');
    if (!request.asset) errors.push('Asset required');
    if (!['CALL', 'PUT'].includes(request.direction)) errors.push('Invalid direction');
    if (!request.amount || request.amount <= 0) errors.push('Invalid amount');

    // Check amount limits
    const settings = await this.services.user.getUserSettings(request.userId);
    if (request.amount > settings.max_trade_amount) {
      errors.push(`Amount exceeds maximum allowed: $${settings.max_trade_amount}`);
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Check risk management limits
   */
  async checkRiskLimits(userId, amount) {
    const riskCheck = await this.services.risk.checkTradeEligibility(userId, amount);

    if (!riskCheck.isEligible) {
      throw new Error(`Risk check failed: ${riskCheck.reason}`);
    }
  }

  /**
   * Get current market data
   */
  async getMarketData(asset) {
    try {
      // This would integrate with data feeds
      return {
        currentPrice: 100 + Math.random() * 50, // Mock price
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Market data fetch error', { asset, error: error.message });
      throw error;
    }
  }

  /**
   * Execute trade on IQ Option
   */
  async executeOnIQOption(tradeData) {
    try {
      const result = await this.services.trading.executeTradeOnIQOption(tradeData);

      return {
        success: result.success,
        iqOptionTradeId: result.iqOptionTradeId,
        entryPrice: result.entryPrice,
        executionTime: new Date(),
        error: result.error
      };

    } catch (error) {
      this.logger.error('IQ Option execution error', {
        userId: tradeData.userId,
        asset: tradeData.asset,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save trade record to database
   */
  async saveTradeRecord(tradeData) {
    try {
      const Trade = this.services.database.getModel('Trade');

      const tradeRecord = await Trade.create({
        user_id: tradeData.userId,
        asset_symbol: tradeData.asset,
        asset_type: tradeData.assetType || 'stock',
        direction: tradeData.direction,
        amount: tradeData.amount,
        entry_price: tradeData.executionResult.entryPrice,
        iq_option_trade_id: tradeData.executionResult.iqOptionTradeId,
        status: 'OPEN',
        entry_time: tradeData.executionResult.executionTime,
        expiry_minutes: tradeData.expiryMinutes,
        signal_data: tradeData.signalData
      });

      this.logger.info('Trade record saved', { tradeId: tradeRecord.id });
      return tradeRecord;

    } catch (error) {
      this.logger.error('Trade record save error', { error: error.message });
      throw error;
    }
  }

  /**
   * Start position monitoring
   */
  async startPositionMonitoring(tradeRecord) {
    try {
      await this.services.monitor.startMonitoringTrade(tradeRecord.id, {
        userId: tradeRecord.user_id,
        asset: tradeRecord.asset_symbol,
        direction: tradeRecord.direction,
        amount: tradeRecord.amount,
        entryPrice: tradeRecord.entry_price,
        duration: tradeRecord.expiry_minutes
      });

    } catch (error) {
      this.logger.error('Position monitoring start error', {
        tradeId: tradeRecord.id,
        error: error.message
      });
      // Don't throw - monitoring failure shouldn't stop trade execution
    }
  }

  /**
   * Send trade confirmation
   */
  async sendTradeConfirmation(userId, tradeRecord) {
    try {
      if (this.services.notification) {
        await this.services.notification.sendTradeConfirmation(userId, tradeRecord);
      }
    } catch (error) {
      this.logger.error('Trade confirmation send error', {
        userId,
        tradeId: tradeRecord.id,
        error: error.message
      });
    }
  }

  /**
   * Send trade failure notification
   */
  async sendTradeFailureNotification(userId, tradeData) {
    try {
      if (this.services.notification) {
        await this.services.notification.sendTradeFailure(userId, tradeData);
      }
    } catch (error) {
      this.logger.error('Trade failure notification error', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * Update user statistics
   */
  async updateUserStats(userId, tradeRecord) {
    try {
      await this.services.user.updateTradingStats(userId, 'TRADE_OPENED', 0);
    } catch (error) {
      this.logger.error('User stats update error', {
        userId,
        tradeId: tradeRecord.id,
        error: error.message
      });
    }
  }

  /**
   * Execute multiple trades (batch)
   */
  async executeBatchTrades(tradeRequests) {
    const results = [];

    for (const request of tradeRequests) {
      try {
        const result = await this.executeTrade(request);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          request,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Cancel trade
   */
  async cancelTrade(tradeId, userId, reason = 'User cancelled') {
    try {
      // Check if trade belongs to user
      const trade = await this.services.database.getModel('Trade').findOne({
        where: { id: tradeId, user_id: userId, status: 'OPEN' }
      });

      if (!trade) {
        throw new Error('Trade not found or already closed');
      }

      // Cancel on IQ Option (if possible)
      await this.cancelTradeOnIQOption(trade.iq_option_trade_id);

      // Update database
      trade.status = 'CANCELLED';
      trade.close_time = new Date();
      trade.notes = reason;
      await trade.save();

      // Stop monitoring
      this.services.monitor.removePosition(tradeId);

      // Send notification
      await this.sendTradeCancellationNotification(userId, trade);

      this.logger.info('Trade cancelled', { tradeId, userId, reason });
      return { success: true, trade };

    } catch (error) {
      this.logger.error('Trade cancellation error', {
        tradeId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel trade on IQ Option
   */
  async cancelTradeOnIQOption(iqOptionTradeId) {
    // This would integrate with IQ Option API to cancel trade
    // For now, just log
    this.logger.info('Cancelling trade on IQ Option', { iqOptionTradeId });
  }

  /**
   * Send trade cancellation notification
   */
  async sendTradeCancellationNotification(userId, trade) {
    try {
      if (this.services.notification) {
        await this.services.notification.sendTradeCancellation(userId, trade);
      }
    } catch (error) {
      this.logger.error('Cancellation notification error', {
        userId,
        tradeId: trade.id,
        error: error.message
      });
    }
  }

  /**
   * Get trade execution statistics
   */
  getExecutionStatistics() {
    return {
      status: this.isInitialized ? 'active' : 'inactive',
      pendingTrades: 0, // Would track pending trades
      activeTrades: 0, // Would track active trades
      lastExecutionTime: new Date()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info('✅ Trade executor cleaned up');
  }
}

module.exports = TradeExecutor;