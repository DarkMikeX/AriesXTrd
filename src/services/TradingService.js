/**
 * Trading Service
 * Coordinates trade execution, monitoring, and management
 */

const IQOptionBot = require('../execution/IQOptionBot');
const RiskManager = require('../risk/RiskManager');
const NotificationService = require('./NotificationService');

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Formatter = require('../utils/Formatter');
const Validator = require('../utils/Validator');

class TradingService {
  constructor(database = null) {
    this.database = database;
    this.iqOptionBot = new IQOptionBot();
    this.riskManager = new RiskManager(database);
    this.notificationService = new NotificationService();
    this.logger = Logger.getInstance();
    this.formatter = new Formatter();
    this.isInitialized = false;

    // Active trade monitoring
    this.activeTrades = new Map();
    this.monitoringInterval = null;
  }

  /**
   * Initialize the trading service
   */
  async initialize() {
    try {
      await this.iqOptionBot.initialize();
      await this.riskManager.initialize();
      await this.notificationService.initialize();

      // Start trade monitoring
      this.startTradeMonitoring();

      this.isInitialized = true;
      this.logger.info('✅ Trading service initialized');

    } catch (error) {
      this.logger.error('Failed to initialize trading service', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a trade
   */
  async executeTrade(tradeParams) {
    try {
      const {
        userId,
        assetSymbol,
        direction,
        amount = 5,
        duration = 5,
        signalId = null,
        confidence = 0
      } = tradeParams;

      this.logger.info('Trade execution requested', {
        userId,
        assetSymbol,
        direction,
        amount,
        duration,
        signalId
      });

      // Validate trade parameters
      const validation = this.validateTradeRequest(tradeParams);
      if (!validation.valid) {
        throw new Error(`Invalid trade request: ${validation.errors.join(', ')}`);
      }

      // Check risk management rules
      const riskCheck = await this.riskManager.checkTradeAllowed(userId, {
        amount,
        assetSymbol,
        direction,
        confidence
      });

      if (!riskCheck.allowed) {
        await this.notificationService.sendNotification(userId, 'risk_limit_exceeded', {
          reason: riskCheck.reason,
          amount,
          assetSymbol
        });

        throw new Error(`Risk management: ${riskCheck.reason}`);
      }

      // Create trade record in database
      const tradeRecord = await this.createTradeRecord({
        user_id: userId,
        asset_symbol: assetSymbol,
        direction,
        amount,
        duration_minutes: duration,
        signal_id: signalId,
        confidence_score: confidence
      });

      // Execute trade on IQ Option
      const tradeResult = await this.iqOptionBot.executeTrade({
        assetSymbol,
        direction,
        amount,
        duration,
        userId
      });

      // Update trade record with execution details
      await this.updateTradeExecution(tradeRecord.id, tradeResult);

      // Start monitoring the trade
      this.startTradeMonitoring(tradeRecord.id, tradeResult.expiryTime);

      // Send execution confirmation
      await this.sendTradeConfirmation(userId, tradeRecord, tradeResult);

      this.logger.info('Trade executed successfully', {
        tradeId: tradeRecord.id,
        userId,
        assetSymbol,
        direction,
        amount
      });

      return {
        success: true,
        tradeId: tradeRecord.id,
        ...tradeResult
      };

    } catch (error) {
      this.logger.error('Trade execution failed', {
        tradeParams,
        error: error.message
      });

      // Log failed trade attempt
      if (tradeParams.userId) {
        await this.logFailedTrade(tradeParams.userId, tradeParams, error.message);
      }

      throw ErrorHandler.handle(error, {
        service: 'trading_service',
        operation: 'execute_trade',
        ...tradeParams
      });
    }
  }

  /**
   * Create trade record in database
   */
  async createTradeRecord(tradeData) {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }

      const Trade = this.database.getModel('Trade');
      const trade = await Trade.create({
        ...tradeData,
        status: 'OPEN',
        iq_option_balance_before: 0, // Would be populated from IQ Option
        potential_profit: (tradeData.amount * 0.95).toFixed(2) // 95% payout
      });

      this.logger.info('Trade record created', { tradeId: trade.id, userId: tradeData.user_id });
      return trade;

    } catch (error) {
      this.logger.error('Failed to create trade record', { tradeData, error: error.message });
      throw error;
    }
  }

  /**
   * Update trade with execution details
   */
  async updateTradeExecution(tradeId, executionResult) {
    try {
      const Trade = this.database.getModel('Trade');
      const [affectedRows] = await Trade.update({
        iq_option_trade_id: executionResult.tradeId,
        entry_price: executionResult.entryPrice,
        expiry_time: executionResult.expiryTime,
        potential_profit: executionResult.potentialProfit,
        iq_option_balance_before: 0, // Would be populated
        screenshot_path: executionResult.screenshotPath
      }, {
        where: { id: tradeId }
      });

      if (affectedRows === 0) {
        throw new Error(`Trade ${tradeId} not found for update`);
      }

      this.logger.info('Trade execution updated', { tradeId, executionResult });

    } catch (error) {
      this.logger.error('Failed to update trade execution', { tradeId, error: error.message });
      throw error;
    }
  }

  /**
   * Start monitoring a trade
   */
  startTradeMonitoring(tradeId, expiryTime) {
    this.activeTrades.set(tradeId, {
      tradeId,
      expiryTime,
      startedAt: new Date(),
      lastChecked: new Date()
    });

    this.logger.info('Trade monitoring started', { tradeId, expiryTime });
  }

  /**
   * Start the trade monitoring loop
   */
  startTradeMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkExpiredTrades();
      } catch (error) {
        this.logger.error('Trade monitoring error', { error: error.message });
      }
    }, 10000); // Check every 10 seconds

    this.logger.info('Trade monitoring loop started');
  }

  /**
   * Check for expired trades and get results
   */
  async checkExpiredTrades() {
    const now = new Date();
    const expiredTrades = [];

    for (const [tradeId, tradeInfo] of this.activeTrades.entries()) {
      if (now >= tradeInfo.expiryTime) {
        expiredTrades.push(tradeInfo);
        this.activeTrades.delete(tradeId);
      }
    }

    for (const tradeInfo of expiredTrades) {
      try {
        await this.processExpiredTrade(tradeInfo.tradeId);
      } catch (error) {
        this.logger.error('Failed to process expired trade', {
          tradeId: tradeInfo.tradeId,
          error: error.message
        });
      }
    }
  }

  /**
   * Process an expired trade
   */
  async processExpiredTrade(tradeId) {
    try {
      // Get trade result from IQ Option
      const tradeResult = await this.iqOptionBot.checkTradeResult(tradeId);

      // Update trade in database
      const Trade = this.database.getModel('Trade');
      const trade = await Trade.findByPk(tradeId);

      if (!trade) {
        this.logger.error('Trade not found for result update', { tradeId });
        return;
      }

      const profit = tradeResult.result === 'WIN' ? trade.potential_profit : -trade.amount;

      await trade.update({
        status: 'CLOSED',
        result: tradeResult.result,
        exit_price: tradeResult.exitPrice,
        profit_loss: profit,
        exit_time: tradeResult.checkedAt
      });

      // Update user statistics
      await this.updateUserStats(trade.user_id, tradeResult.result, profit);

      // Send result notification
      await this.sendTradeResultNotification(trade.user_id, trade, tradeResult);

      this.logger.info('Trade result processed', {
        tradeId,
        result: tradeResult.result,
        profit,
        userId: trade.user_id
      });

    } catch (error) {
      this.logger.error('Failed to process expired trade', { tradeId, error: error.message });
    }
  }

  /**
   * Update user trading statistics
   */
  async updateUserStats(userId, result, profit) {
    try {
      if (!this.database) return;

      const User = this.database.getModel('User');
      const user = await User.findByPk(userId);

      if (user) {
        user.updateStats(result, profit);
        await user.save();

        this.logger.info('User stats updated', {
          userId,
          result,
          profit,
          totalTrades: user.total_trades,
          winRate: user.win_rate
        });
      }

    } catch (error) {
      this.logger.error('Failed to update user stats', { userId, result, profit, error: error.message });
    }
  }

  /**
   * Send trade confirmation notification
   */
  async sendTradeConfirmation(userId, trade, executionResult) {
    try {
      const message = `✅ *TRADE EXECUTED SUCCESSFULLY*

📍 Asset: ${trade.asset_symbol}
🎯 Direction: ${trade.direction}
💵 Amount: $${trade.amount}
⏰ Expiry: ${this.formatter.formatDate(trade.expiry_time, 'HH:mm:ss')}
💰 Potential Profit: $${trade.potential_profit}

🔔 I'll notify you when the trade closes!`;

      await this.notificationService.sendNotification(userId, 'trade_executed', {
        trade,
        executionResult,
        message
      });

    } catch (error) {
      this.logger.error('Failed to send trade confirmation', { userId, tradeId: trade.id, error: error.message });
    }
  }

  /**
   * Send trade result notification
   */
  async sendTradeResultNotification(userId, trade, result) {
    try {
      const isWin = result.result === 'WIN';
      const profitText = isWin ? `+$${result.profit}` : `$${result.profit}`;
      const emoji = isWin ? '🎉' : '❌';

      const message = `${emoji} *TRADE ${result.result.toUpperCase()}* ${emoji}

📍 Asset: ${trade.asset_symbol}
🎯 Direction: ${trade.direction}
💵 Amount: $${trade.amount}
📊 Entry: $${trade.entry_price.toFixed(2)}
📈 Exit: $${result.exitPrice.toFixed(2)}
💰 Result: ${profitText}

📊 *Current Stats:*
Wins: ${trade.user?.winning_trades || 0}
Losses: ${trade.user?.losing_trades || 0}
Win Rate: ${trade.user?.win_rate || 0}%`;

      await this.notificationService.sendNotification(userId, 'trade_result', {
        trade,
        result,
        message,
        isWin
      });

    } catch (error) {
      this.logger.error('Failed to send trade result notification', {
        userId,
        tradeId: trade.id,
        error: error.message
      });
    }
  }

  /**
   * Get user's active trades
   */
  async getActiveTrades(userId) {
    try {
      if (!this.database) return [];

      const Trade = this.database.getModel('Trade');
      const trades = await Trade.findAll({
        where: {
          user_id: userId,
          status: 'OPEN'
        },
        order: [['entry_time', 'DESC']]
      });

      return trades.map(trade => ({
        id: trade.id,
        asset: trade.asset_symbol,
        direction: trade.direction,
        amount: trade.amount,
        entryPrice: trade.entry_price,
        entryTime: trade.entry_time,
        expiryTime: trade.expiry_time,
        potentialProfit: trade.potential_profit,
        timeRemaining: Math.max(0, Math.floor((trade.expiry_time - new Date()) / 1000))
      }));

    } catch (error) {
      this.logger.error('Failed to get active trades', { userId, error: error.message });
      return [];
    }
  }

  /**
   * Get user's trade history
   */
  async getTradeHistory(userId, options = {}) {
    try {
      const { limit = 20, offset = 0, status = null, asset = null } = options;

      if (!this.database) return { trades: [], total: 0 };

      const Trade = this.database.getModel('Trade');
      const whereClause = { user_id: userId };

      if (status) whereClause.status = status;
      if (asset) whereClause.asset_symbol = asset;

      const { count, rows } = await Trade.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['entry_time', 'DESC']],
        include: [{
          model: this.database.getModel('Signal'),
          as: 'signal',
          required: false
        }]
      });

      const trades = rows.map(trade => ({
        id: trade.id,
        asset: trade.asset_symbol,
        direction: trade.direction,
        amount: trade.amount,
        entryPrice: trade.entry_price,
        exitPrice: trade.exit_price,
        result: trade.result,
        profit: trade.profit_loss,
        status: trade.status,
        entryTime: trade.entry_time,
        exitTime: trade.exit_time,
        expiryTime: trade.expiry_time,
        signal: trade.signal ? {
          confidence: trade.signal.confidence_score,
          type: trade.signal.signal_type
        } : null
      }));

      return {
        trades,
        total: count,
        limit,
        offset
      };

    } catch (error) {
      this.logger.error('Failed to get trade history', { userId, options, error: error.message });
      return { trades: [], total: 0 };
    }
  }

  /**
   * Cancel a trade (if possible)
   */
  async cancelTrade(userId, tradeId) {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }

      const Trade = this.database.getModel('Trade');
      const trade = await Trade.findOne({
        where: {
          id: tradeId,
          user_id: userId,
          status: 'OPEN'
        }
      });

      if (!trade) {
        throw new Error('Trade not found or cannot be cancelled');
      }

      // Check if trade can still be cancelled (time remaining)
      const timeRemaining = trade.expiry_time - new Date();
      if (timeRemaining < 30000) { // Less than 30 seconds
        throw new Error('Trade cannot be cancelled - too close to expiry');
      }

      // Update trade status
      trade.status = 'CANCELLED';
      trade.notes = 'Cancelled by user';
      await trade.save();

      // Remove from active monitoring
      this.activeTrades.delete(tradeId);

      // Send cancellation notification
      await this.notificationService.sendNotification(userId, 'trade_cancelled', {
        trade,
        reason: 'Cancelled by user'
      });

      this.logger.info('Trade cancelled', { tradeId, userId });
      return { success: true, trade };

    } catch (error) {
      this.logger.error('Trade cancellation failed', { userId, tradeId, error: error.message });
      throw error;
    }
  }

  /**
   * Emergency stop all trading
   */
  async emergencyStop(userId) {
    try {
      this.logger.warn('Emergency stop initiated', { userId });

      // Cancel all open trades for user
      const activeTrades = await this.getActiveTrades(userId);

      for (const trade of activeTrades) {
        try {
          await this.cancelTrade(userId, trade.id);
        } catch (error) {
          this.logger.error('Failed to cancel trade during emergency stop', {
            tradeId: trade.id,
            error: error.message
          });
        }
      }

      // Stop IQ Option bot
      await this.iqOptionBot.emergencyStop();

      // Send emergency stop notification
      await this.notificationService.sendNotification(userId, 'emergency_stop', {
        cancelledTrades: activeTrades.length,
        message: 'All trading activities have been stopped'
      });

      return {
        success: true,
        cancelledTrades: activeTrades.length,
        message: 'Emergency stop completed'
      };

    } catch (error) {
      this.logger.error('Emergency stop failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Validate trade request
   */
  validateTradeRequest(params) {
    const errors = [];

    if (!params.userId) {
      errors.push('User ID is required');
    }

    if (!params.assetSymbol) {
      errors.push('Asset symbol is required');
    }

    if (!['CALL', 'PUT'].includes(params.direction)) {
      errors.push('Direction must be CALL or PUT');
    }

    if (!Validator.isValidTradeAmount(params.amount)) {
      errors.push('Invalid trade amount');
    }

    if (!Validator.isValidTradeDuration(params.duration)) {
      errors.push('Invalid trade duration');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Log failed trade attempt
   */
  async logFailedTrade(userId, tradeParams, errorMessage) {
    try {
      // Could save to a failed trades log or database table
      this.logger.warn('Trade attempt failed', {
        userId,
        tradeParams,
        errorMessage
      });
    } catch (error) {
      // Ignore logging errors
    }
  }

  /**
   * Get trading statistics
   */
  async getTradingStats(userId, period = 'all') {
    try {
      const history = await this.getTradeHistory(userId, { limit: 1000 });

      if (history.total === 0) {
        return {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          totalProfit: 0,
          averageTrade: 0
        };
      }

      const trades = history.trades.filter(t => t.status === 'CLOSED');
      const wins = trades.filter(t => t.result === 'WIN').length;
      const losses = trades.filter(t => t.result === 'LOSS').length;
      const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
      const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
      const averageTrade = trades.length > 0 ? totalProfit / trades.length : 0;

      return {
        totalTrades: trades.length,
        wins,
        losses,
        winRate: parseFloat(winRate.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        averageTrade: parseFloat(averageTrade.toFixed(2))
      };

    } catch (error) {
      this.logger.error('Failed to get trading stats', { userId, period, error: error.message });
      return null;
    }
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      iq_option_bot: this.iqOptionBot.getHealth(),
      risk_manager: this.riskManager.getHealth(),
      notification_service: this.notificationService.getHealth(),
      active_trades: this.activeTrades.size,
      monitoring_active: this.monitoringInterval !== null
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      await this.iqOptionBot.cleanup();
      await this.riskManager.cleanup();
      await this.notificationService.cleanup();

      this.activeTrades.clear();

      this.logger.info('✅ Trading service cleaned up');
    } catch (error) {
      this.logger.error('Error during trading service cleanup', { error: error.message });
    }
  }
}

module.exports = TradingService;