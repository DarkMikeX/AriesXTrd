/**
 * Risk Manager Service
 * Handles all risk management and position sizing logic
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Calculator = require('../utils/Calculator');

class RiskManager {
  constructor(database = null) {
    this.database = database;
    this.logger = Logger.getInstance();
    this.isInitialized = false;

    // Risk settings cache
    this.userSettingsCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the risk manager
   */
  async initialize() {
    try {
      this.isInitialized = true;
      this.logger.info('✅ Risk manager initialized');

    } catch (error) {
      this.logger.error('Failed to initialize risk manager', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if a trade is allowed based on risk management rules
   */
  async checkTradeAllowed(userId, tradeParams) {
    try {
      const { amount, assetSymbol, direction, confidence } = tradeParams;

      // Get user settings
      const settings = await this.getUserSettings(userId);

      // Check 1: Auto-trading enabled
      if (!settings.auto_trading_enabled && !tradeParams.manual) {
        return {
          allowed: false,
          reason: 'Auto-trading is disabled. Enable it in settings or execute trades manually.'
        };
      }

      // Check 2: Minimum confidence threshold
      if (confidence < settings.min_confidence_threshold) {
        return {
          allowed: false,
          reason: `Signal confidence (${confidence}%) is below minimum threshold (${settings.min_confidence_threshold}%).`
        };
      }

      // Check 3: Maximum trade amount
      if (amount > settings.max_trade_amount) {
        return {
          allowed: false,
          reason: `Trade amount ($${amount}) exceeds maximum allowed ($${settings.max_trade_amount}).`
        };
      }

      // Check 4: Daily trade limit
      const dailyTrades = await this.getDailyTradeCount(userId);
      if (dailyTrades >= settings.max_daily_trades) {
        return {
          allowed: false,
          reason: `Daily trade limit reached (${settings.max_daily_trades} trades).`
        };
      }

      // Check 5: Daily loss limit
      const dailyLoss = await this.getDailyLoss(userId);
      if (dailyLoss >= settings.daily_loss_limit) {
        return {
          allowed: false,
          reason: `Daily loss limit reached ($${dailyLoss.toFixed(2)}). Trading stopped for safety.`
        };
      }

      // Check 6: Consecutive losses limit
      const consecutiveLosses = await this.getConsecutiveLosses(userId);
      if (consecutiveLosses >= settings.max_consecutive_losses) {
        return {
          allowed: false,
          reason: `Too many consecutive losses (${consecutiveLosses}). Cooling period required.`
        };
      }

      // Check 7: Balance check (if enabled)
      if (settings.iq_option_balance_check !== false) {
        const balanceCheck = await this.checkBalance(userId, amount);
        if (!balanceCheck.allowed) {
          return balanceCheck;
        }
      }

      // Check 8: Position sizing
      const positionSize = await this.calculatePositionSize(userId, amount, assetSymbol);
      if (!positionSize.allowed) {
        return positionSize;
      }

      // Check 9: Asset-specific limits
      const assetCheck = await this.checkAssetLimits(userId, assetSymbol, amount);
      if (!assetCheck.allowed) {
        return assetCheck;
      }

      // All checks passed
      return {
        allowed: true,
        positionSize: positionSize.size,
        riskPercent: positionSize.riskPercent
      };

    } catch (error) {
      this.logger.error('Risk check failed', { userId, tradeParams, error: error.message });
      return {
        allowed: false,
        reason: 'Risk assessment failed. Please try again.'
      };
    }
  }

  /**
   * Get user risk settings
   */
  async getUserSettings(userId) {
    try {
      // Check cache first
      const cached = this.userSettingsCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.settings;
      }

      if (!this.database) {
        // Return default settings if no database
        return this.getDefaultSettings();
      }

      const Settings = this.database.getModel('Settings');
      let settings = await Settings.findOne({
        where: { user_id: userId }
      });

      if (!settings) {
        // Create default settings for user
        settings = await Settings.create({
          user_id: userId,
          ...this.getDefaultSettings()
        });
      }

      // Convert to plain object and cache
      const settingsData = settings.toJSON();
      this.userSettingsCache.set(userId, {
        settings: settingsData,
        timestamp: Date.now()
      });

      return settingsData;

    } catch (error) {
      this.logger.error('Failed to get user settings', { userId, error: error.message });
      return this.getDefaultSettings();
    }
  }

  /**
   * Get default risk settings
   */
  getDefaultSettings() {
    return {
      auto_trading_enabled: false,
      min_confidence_threshold: 75,
      default_trade_amount: 5,
      max_trade_amount: 20,
      max_daily_trades: 20,
      daily_loss_limit: 50,
      daily_profit_target: 100,
      max_consecutive_losses: 3,
      max_position_size_percent: 5,
      cooling_period_minutes: 15
    };
  }

  /**
   * Get daily trade count for user
   */
  async getDailyTradeCount(userId) {
    try {
      if (!this.database) return 0;

      const Trade = this.database.getModel('Trade');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const count = await Trade.count({
        where: {
          user_id: userId,
          entry_time: {
            [this.database.getSequelize().Op.gte]: today,
            [this.database.getSequelize().Op.lt]: tomorrow
          }
        }
      });

      return count;

    } catch (error) {
      this.logger.error('Failed to get daily trade count', { userId, error: error.message });
      return 0;
    }
  }

  /**
   * Get daily loss amount for user
   */
  async getDailyLoss(userId) {
    try {
      if (!this.database) return 0;

      const Trade = this.database.getModel('Trade');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const trades = await Trade.findAll({
        where: {
          user_id: userId,
          entry_time: {
            [this.database.getSequelize().Op.gte]: today,
            [this.database.getSequelize().Op.lt]: tomorrow
          },
          result: 'LOSS'
        },
        attributes: ['profit_loss']
      });

      const totalLoss = trades.reduce((sum, trade) => {
        return sum + Math.abs(trade.profit_loss || 0);
      }, 0);

      return totalLoss;

    } catch (error) {
      this.logger.error('Failed to get daily loss', { userId, error: error.message });
      return 0;
    }
  }

  /**
   * Get consecutive losses for user
   */
  async getConsecutiveLosses(userId) {
    try {
      if (!this.database) return 0;

      const Trade = this.database.getModel('Trade');
      const recentTrades = await Trade.findAll({
        where: { user_id: userId },
        order: [['entry_time', 'DESC']],
        limit: 10,
        attributes: ['result']
      });

      let consecutiveLosses = 0;
      for (const trade of recentTrades) {
        if (trade.result === 'LOSS') {
          consecutiveLosses++;
        } else {
          break; // Stop at first non-loss
        }
      }

      return consecutiveLosses;

    } catch (error) {
      this.logger.error('Failed to get consecutive losses', { userId, error: error.message });
      return 0;
    }
  }

  /**
   * Check account balance
   */
  async checkBalance(userId, requiredAmount) {
    try {
      // In production, this would check actual IQ Option balance
      // For now, simulate balance check
      const mockBalance = 150.75; // Mock balance

      if (mockBalance < requiredAmount) {
        return {
          allowed: false,
          reason: `Insufficient balance. Available: $${mockBalance.toFixed(2)}, Required: $${requiredAmount}`
        };
      }

      const buffer = requiredAmount * 0.1; // 10% buffer
      if (mockBalance < requiredAmount + buffer) {
        return {
          allowed: false,
          reason: `Low balance warning. Available: $${mockBalance.toFixed(2)} (recommended minimum: $${(requiredAmount + buffer).toFixed(2)})`
        };
      }

      return { allowed: true, balance: mockBalance };

    } catch (error) {
      this.logger.error('Balance check failed', { userId, requiredAmount, error: error.message });
      return {
        allowed: false,
        reason: 'Balance check failed. Please try again.'
      };
    }
  }

  /**
   * Calculate position size based on risk management
   */
  async calculatePositionSize(userId, requestedAmount, assetSymbol) {
    try {
      const settings = await this.getUserSettings(userId);
      const maxPositionPercent = settings.max_position_size_percent || 5;

      // Get account balance (mock for now)
      const balance = 150.75;
      const maxPositionAmount = (balance * maxPositionPercent) / 100;

      if (requestedAmount > maxPositionAmount) {
        return {
          allowed: false,
          reason: `Position size ($${requestedAmount}) exceeds maximum allowed (${maxPositionPercent}% of balance = $${maxPositionAmount.toFixed(2)})`
        };
      }

      // Calculate risk percentage
      const riskPercent = (requestedAmount / balance) * 100;

      return {
        allowed: true,
        size: requestedAmount,
        riskPercent: parseFloat(riskPercent.toFixed(2)),
        maxAllowed: maxPositionAmount
      };

    } catch (error) {
      this.logger.error('Position size calculation failed', { userId, requestedAmount, error: error.message });
      return {
        allowed: false,
        reason: 'Position size calculation failed'
      };
    }
  }

  /**
   * Check asset-specific limits
   */
  async checkAssetLimits(userId, assetSymbol, amount) {
    try {
      // Get asset type and check preferences
      const assetType = this.getAssetType(assetSymbol);
      const settings = await this.getUserSettings(userId);

      if (!settings.preferred_assets.includes(assetType)) {
        return {
          allowed: false,
          reason: `${assetType} trading is disabled in your settings. Enable it to trade ${assetSymbol}.`
        };
      }

      // Check asset-specific limits (could be expanded)
      const assetLimits = {
        stock: { maxAmount: 50 },
        forex: { maxAmount: 100 },
        crypto: { maxAmount: 25 }
      };

      const limit = assetLimits[assetType];
      if (limit && amount > limit.maxAmount) {
        return {
          allowed: false,
          reason: `Maximum trade amount for ${assetType} is $${limit.maxAmount}`
        };
      }

      return { allowed: true };

    } catch (error) {
      this.logger.error('Asset limits check failed', { userId, assetSymbol, error: error.message });
      return {
        allowed: false,
        reason: 'Asset limits check failed'
      };
    }
  }

  /**
   * Get asset type from symbol
   */
  getAssetType(symbol) {
    // Simple asset type detection
    if (symbol.includes('/')) return 'forex'; // EUR/USD format
    if (symbol.length <= 5 && /^[A-Z]+$/.test(symbol)) return 'stock';
    if (symbol.includes('USD') || symbol.includes('BTC') || symbol.includes('ETH')) return 'crypto';

    return 'unknown';
  }

  /**
   * Calculate stop loss level
   */
  calculateStopLoss(entryPrice, direction, atr, multiplier = 2) {
    try {
      if (!atr || !entryPrice) return null;

      const stopDistance = atr * multiplier;

      if (direction === 'CALL') {
        return entryPrice - stopDistance;
      } else {
        return entryPrice + stopDistance;
      }

    } catch (error) {
      this.logger.error('Stop loss calculation failed', { entryPrice, direction, atr, error: error.message });
      return null;
    }
  }

  /**
   * Calculate take profit level
   */
  calculateTakeProfit(entryPrice, direction, atr, riskRewardRatio = 2) {
    try {
      if (!atr || !entryPrice) return null;

      const profitDistance = atr * riskRewardRatio;

      if (direction === 'CALL') {
        return entryPrice + profitDistance;
      } else {
        return entryPrice - profitDistance;
      }

    } catch (error) {
      this.logger.error('Take profit calculation failed', { entryPrice, direction, atr, error: error.message });
      return null;
    }
  }

  /**
   * Get risk profile assessment
   */
  async getRiskProfile(userId) {
    try {
      const settings = await this.getUserSettings(userId);
      const stats = await this.getTradingStats(userId);

      let riskLevel = 'moderate';
      let recommendations = [];

      // Assess based on settings
      if (settings.daily_loss_limit < 25) {
        riskLevel = 'high';
        recommendations.push('Consider increasing daily loss limit for more flexibility');
      } else if (settings.daily_loss_limit > 100) {
        riskLevel = 'low';
        recommendations.push('Your risk settings are conservative');
      }

      if (settings.max_trade_amount > 50) {
        riskLevel = 'high';
        recommendations.push('Large trade amounts increase risk exposure');
      }

      if (settings.max_consecutive_losses < 2) {
        riskLevel = 'high';
        recommendations.push('Low consecutive loss limit may stop trading too early');
      }

      // Assess based on performance
      if (stats && stats.winRate < 50) {
        riskLevel = 'high';
        recommendations.push('Low win rate suggests strategy review needed');
      }

      return {
        riskLevel,
        assessment: this.getRiskAssessmentDescription(riskLevel),
        recommendations,
        settings: {
          dailyLossLimit: settings.daily_loss_limit,
          maxTradeAmount: settings.max_trade_amount,
          maxConsecutiveLosses: settings.max_consecutive_losses
        },
        performance: stats ? {
          winRate: stats.winRate,
          totalTrades: stats.totalTrades,
          totalProfit: stats.totalProfit
        } : null
      };

    } catch (error) {
      this.logger.error('Risk profile assessment failed', { userId, error: error.message });
      return {
        riskLevel: 'unknown',
        assessment: 'Unable to assess risk profile',
        recommendations: ['Contact support if issues persist']
      };
    }
  }

  /**
   * Get risk assessment description
   */
  getRiskAssessmentDescription(riskLevel) {
    const descriptions = {
      low: 'Your risk settings are conservative with good protection against losses.',
      moderate: 'Your risk settings provide balanced protection and trading opportunities.',
      high: 'Your risk settings are aggressive and may lead to significant losses.',
      unknown: 'Unable to determine risk level.'
    };

    return descriptions[riskLevel] || descriptions.unknown;
  }

  /**
   * Get trading statistics for risk assessment
   */
  async getTradingStats(userId) {
    try {
      if (!this.database) return null;

      const Trade = this.database.getModel('Trade');
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trades = await Trade.findAll({
        where: {
          user_id: userId,
          entry_time: { [this.database.getSequelize().Op.gte]: thirtyDaysAgo },
          status: 'CLOSED'
        },
        attributes: ['result', 'profit_loss']
      });

      if (trades.length === 0) return null;

      const wins = trades.filter(t => t.result === 'WIN').length;
      const losses = trades.filter(t => t.result === 'LOSS').length;
      const totalProfit = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
      const winRate = (wins / trades.length) * 100;

      return {
        totalTrades: trades.length,
        wins,
        losses,
        winRate: parseFloat(winRate.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2))
      };

    } catch (error) {
      this.logger.error('Failed to get trading stats', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Update user risk settings
   */
  async updateSettings(userId, newSettings) {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }

      const Settings = this.database.getModel('Settings');
      const [settings, created] = await Settings.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId }
      });

      // Validate new settings
      const validation = this.validateSettings(newSettings);
      if (!validation.valid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }

      // Update settings
      await settings.update(newSettings);

      // Clear cache
      this.userSettingsCache.delete(userId);

      this.logger.info('Risk settings updated', { userId, newSettings });
      return settings;

    } catch (error) {
      this.logger.error('Failed to update risk settings', { userId, newSettings, error: error.message });
      throw error;
    }
  }

  /**
   * Validate risk settings
   */
  validateSettings(settings) {
    const errors = [];

    if (settings.daily_loss_limit !== undefined && settings.daily_loss_limit < 0) {
      errors.push('Daily loss limit cannot be negative');
    }

    if (settings.max_trade_amount !== undefined && settings.max_trade_amount <= 0) {
      errors.push('Maximum trade amount must be positive');
    }

    if (settings.max_consecutive_losses !== undefined &&
        (!Number.isInteger(settings.max_consecutive_losses) || settings.max_consecutive_losses < 1)) {
      errors.push('Maximum consecutive losses must be a positive integer');
    }

    if (settings.min_confidence_threshold !== undefined &&
        (settings.min_confidence_threshold < 0 || settings.min_confidence_threshold > 100)) {
      errors.push('Confidence threshold must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Reset user settings to defaults
   */
  async resetSettings(userId) {
    try {
      await this.updateSettings(userId, this.getDefaultSettings());
      this.logger.info('Risk settings reset to defaults', { userId });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to reset risk settings', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get risk alerts for user
   */
  async getRiskAlerts(userId) {
    try {
      const alerts = [];
      const settings = await this.getUserSettings(userId);

      // Check daily limits
      const dailyTrades = await this.getDailyTradeCount(userId);
      const dailyLoss = await this.getDailyLoss(userId);

      if (dailyTrades >= settings.max_daily_trades * 0.8) {
        alerts.push({
          type: 'warning',
          message: `Approaching daily trade limit: ${dailyTrades}/${settings.max_daily_trades} trades`
        });
      }

      if (dailyLoss >= settings.daily_loss_limit * 0.8) {
        alerts.push({
          type: 'danger',
          message: `Approaching daily loss limit: $${dailyLoss.toFixed(2)}/$${settings.daily_loss_limit}`
        });
      }

      // Check consecutive losses
      const consecutiveLosses = await this.getConsecutiveLosses(userId);
      if (consecutiveLosses >= settings.max_consecutive_losses - 1) {
        alerts.push({
          type: 'warning',
          message: `High consecutive losses: ${consecutiveLosses} losses in a row`
        });
      }

      return {
        alerts,
        total: alerts.length,
        critical: alerts.filter(a => a.type === 'danger').length
      };

    } catch (error) {
      this.logger.error('Failed to get risk alerts', { userId, error: error.message });
      return { alerts: [], total: 0, critical: 0 };
    }
  }

  /**
   * Advanced risk assessment with volatility and probability calculations
   * Similar to Spike AI Trading Bot's risk assessment
   */
  async assessAdvancedRisk(tradeParams, marketData) {
    try {
      const { confidence, assetSymbol, direction, amount } = tradeParams;
      const candles = marketData?.candles || [];

      // 1. Calculate volatility
      const volatility = this.calculateVolatility(candles);

      // 2. Calculate success probability
      const successProbability = this.calculateSuccessProbability(confidence, volatility, marketData);

      // 3. Calculate risk-adjusted position size
      const riskAdjustedSize = this.calculateRiskAdjustedPositionSize(
        amount,
        volatility,
        successProbability
      );

      // 4. Analyze volatility patterns
      const volatilityPattern = this.analyzeVolatilityPattern(candles);

      // 5. Calculate expected value
      const expectedValue = this.calculateExpectedValue(
        amount,
        successProbability,
        confidence
      );

      // 6. Risk rating
      const riskRating = this.calculateRiskRating(
        volatility,
        successProbability,
        amount
      );

      return {
        volatility: {
          current: volatility.current,
          average: volatility.average,
          level: volatility.level,
          trend: volatility.trend
        },
        successProbability: {
          probability: successProbability.probability,
          confidence: successProbability.confidence,
          factors: successProbability.factors
        },
        positionSize: {
          requested: amount,
          recommended: riskAdjustedSize.amount,
          riskPercent: riskAdjustedSize.riskPercent,
          adjustment: riskAdjustedSize.reason
        },
        expectedValue: {
          expected: expectedValue.expected,
          winAmount: expectedValue.winAmount,
          lossAmount: expectedValue.lossAmount,
          positive: expectedValue.expected > 0
        },
        riskRating,
        recommendation: this.getTradeRecommendation(
          riskRating,
          successProbability,
          volatility
        )
      };

    } catch (error) {
      this.logger.error('Advanced risk assessment failed', { tradeParams, error: error.message });
      return {
        volatility: { current: 0, average: 0, level: 'unknown' },
        successProbability: { probability: 50, confidence: 0 },
        riskRating: 'medium'
      };
    }
  }

  /**
   * Calculate volatility from candles
   */
  calculateVolatility(candles) {
    if (!candles || candles.length < 10) {
      return { current: 0, average: 0, level: 'low', trend: 'unknown' };
    }

    const priceChanges = [];
    for (let i = 1; i < candles.length; i++) {
      const change = Math.abs((candles[i].close - candles[i-1].close) / candles[i-1].close);
      priceChanges.push(change);
    }

    const currentVolatility = priceChanges.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, priceChanges.length);
    const averageVolatility = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;

    let level = 'low';
    if (averageVolatility > 0.03) level = 'high';
    else if (averageVolatility > 0.015) level = 'medium';

    let trend = 'stable';
    if (currentVolatility > averageVolatility * 1.2) trend = 'increasing';
    else if (currentVolatility < averageVolatility * 0.8) trend = 'decreasing';

    return {
      current: parseFloat(currentVolatility.toFixed(4)),
      average: parseFloat(averageVolatility.toFixed(4)),
      level,
      trend
    };
  }

  /**
   * Calculate success probability based on confidence, volatility, and market conditions
   */
  calculateSuccessProbability(confidence, volatility, marketData) {
    let baseProbability = confidence || 50; // Start with signal confidence

    // Volatility adjustment: high volatility reduces probability
    const volatilityAdjustment = volatility.level === 'high' ? -10 : 
                                 volatility.level === 'medium' ? -5 : 0;

    // Trend confirmation: if market data shows strong trend, increase probability
    let trendAdjustment = 0;
    if (marketData?.indicators) {
      const indicators = marketData.indicators;
      
      // RSI alignment
      if (indicators.rsi?.signal === 'oversold' || indicators.rsi?.signal === 'overbought') {
        trendAdjustment += 5;
      }

      // MACD alignment
      if (indicators.macd?.signal?.includes('crossover')) {
        trendAdjustment += 5;
      }
    }

    // Volume confirmation
    const volumeAdjustment = marketData?.indicators?.volume?.signal?.includes('increasing') ? 3 : 0;

    // Calculate final probability
    const finalProbability = Math.max(30, Math.min(95, 
      baseProbability + volatilityAdjustment + trendAdjustment + volumeAdjustment
    ));

    return {
      probability: Math.round(finalProbability),
      confidence: Math.min(1.0, baseProbability / 100),
      factors: {
        baseConfidence: baseProbability,
        volatilityImpact: volatilityAdjustment,
        trendConfirmation: trendAdjustment,
        volumeConfirmation: volumeAdjustment
      }
    };
  }

  /**
   * Calculate risk-adjusted position size
   */
  calculateRiskAdjustedPositionSize(requestedAmount, volatility, successProbability) {
    const prob = successProbability.probability || 50;
    const volLevel = volatility.level || 'medium';

    // Adjust position size based on volatility and probability
    let adjustmentFactor = 1.0;

    // High volatility = reduce position size
    if (volLevel === 'high') {
      adjustmentFactor *= 0.7; // Reduce by 30%
    } else if (volLevel === 'low') {
      adjustmentFactor *= 1.1; // Increase by 10% (up to max)
    }

    // Low probability = reduce position size
    if (prob < 60) {
      adjustmentFactor *= 0.8;
    } else if (prob > 80) {
      adjustmentFactor *= 1.05; // Slight increase for high probability
    }

    // Ensure adjustment factor doesn't exceed 1.2 or go below 0.5
    adjustmentFactor = Math.max(0.5, Math.min(1.2, adjustmentFactor));

    const recommendedAmount = requestedAmount * adjustmentFactor;
    const riskPercent = (recommendedAmount / 150.75) * 100; // Assuming balance

    let reason = '';
    if (adjustmentFactor < 0.9) {
      reason = `Reduced due to ${volLevel} volatility and ${prob}% probability`;
    } else if (adjustmentFactor > 1.0) {
      reason = `Slightly increased due to favorable conditions`;
    } else {
      reason = 'Optimal position size based on risk assessment';
    }

    return {
      amount: parseFloat(recommendedAmount.toFixed(2)),
      riskPercent: parseFloat(riskPercent.toFixed(2)),
      adjustmentFactor: parseFloat(adjustmentFactor.toFixed(2)),
      reason
    };
  }

  /**
   * Analyze volatility patterns
   */
  analyzeVolatilityPattern(candles) {
    if (!candles || candles.length < 20) {
      return { pattern: 'unknown', prediction: 'stable' };
    }

    const volatilities = [];
    for (let i = 1; i < candles.length; i++) {
      const change = Math.abs((candles[i].close - candles[i-1].close) / candles[i-1].close);
      volatilities.push(change);
    }

    // Check for volatility clustering (high vol followed by high vol)
    const recentVol = volatilities.slice(-10);
    const avgRecentVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
    const olderVol = volatilities.slice(0, -10);
    const avgOlderVol = olderVol.length > 0 ? 
      olderVol.reduce((a, b) => a + b, 0) / olderVol.length : avgRecentVol;

    let pattern = 'stable';
    if (avgRecentVol > avgOlderVol * 1.3) {
      pattern = 'increasing';
    } else if (avgRecentVol < avgOlderVol * 0.7) {
      pattern = 'decreasing';
    }

    let prediction = 'stable';
    if (pattern === 'increasing') {
      prediction = 'likely_increase';
    } else if (pattern === 'decreasing') {
      prediction = 'likely_decrease';
    }

    return { pattern, prediction };
  }

  /**
   * Calculate expected value of trade
   */
  calculateExpectedValue(amount, successProbability, confidence) {
    const prob = (successProbability.probability || 50) / 100;
    const payout = 0.95; // 95% payout typical for binary options
    
    const winAmount = amount * payout;
    const lossAmount = amount;

    // Expected value = (Probability of Win × Win Amount) - (Probability of Loss × Loss Amount)
    const expectedValue = (prob * winAmount) - ((1 - prob) * lossAmount);

    return {
      expected: parseFloat(expectedValue.toFixed(2)),
      winAmount: parseFloat(winAmount.toFixed(2)),
      lossAmount: parseFloat(lossAmount.toFixed(2)),
      probability: prob
    };
  }

  /**
   * Calculate overall risk rating
   */
  calculateRiskRating(volatility, successProbability, amount) {
    let riskScore = 50; // Start at medium

    // Volatility impact
    if (volatility.level === 'high') riskScore += 20;
    else if (volatility.level === 'low') riskScore -= 15;

    // Probability impact
    const prob = successProbability.probability || 50;
    if (prob < 60) riskScore += 15;
    else if (prob > 80) riskScore -= 10;

    // Amount impact (higher amount = higher risk)
    const riskPercent = (amount / 150.75) * 100;
    if (riskPercent > 5) riskScore += 10;
    else if (riskPercent < 2) riskScore -= 5;

    // Normalize to 0-100
    riskScore = Math.max(0, Math.min(100, riskScore));

    let rating = 'medium';
    if (riskScore > 70) rating = 'high';
    else if (riskScore < 30) rating = 'low';

    return {
      score: Math.round(riskScore),
      rating,
      details: {
        volatilityRisk: volatility.level,
        probabilityRisk: prob < 60 ? 'high' : prob > 80 ? 'low' : 'medium',
        amountRisk: riskPercent > 5 ? 'high' : riskPercent < 2 ? 'low' : 'medium'
      }
    };
  }

  /**
   * Get trade recommendation based on risk assessment
   */
  getTradeRecommendation(riskRating, successProbability, volatility) {
    const rating = riskRating.rating || 'medium';
    const prob = successProbability.probability || 50;

    if (rating === 'low' && prob > 70) {
      return {
        action: 'HIGHLY_RECOMMENDED',
        message: 'Low risk with high success probability - Good opportunity',
        riskLevel: 'low'
      };
    } else if (rating === 'medium' && prob > 60) {
      return {
        action: 'RECOMMENDED',
        message: 'Moderate risk with acceptable probability - Trade with caution',
        riskLevel: 'medium'
      };
    } else if (rating === 'high' || prob < 50) {
      return {
        action: 'NOT_RECOMMENDED',
        message: 'High risk or low probability - Consider waiting for better opportunity',
        riskLevel: 'high'
      };
    } else {
      return {
        action: 'CAUTIOUS',
        message: 'Proceed with extra caution and smaller position size',
        riskLevel: 'medium_high'
      };
    }
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      cache_size: this.userSettingsCache.size,
      database_available: !!this.database
    };
  }

  /**
   * Clear user settings cache
   */
  clearCache(userId = null) {
    if (userId) {
      this.userSettingsCache.delete(userId);
    } else {
      this.userSettingsCache.clear();
    }

    this.logger.info('Risk manager cache cleared', { userId });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.userSettingsCache.clear();
    this.logger.info('✅ Risk manager cleaned up');
  }
}

module.exports = RiskManager;