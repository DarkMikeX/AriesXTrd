/**
 * Position Sizer
 * Calculates optimal trade sizes based on risk management
 */

const Logger = require('../utils/Logger');

class PositionSizer {
  constructor(database) {
    this.database = database;
    this.logger = Logger.getInstance();
  }

  /**
   * Calculate optimal position size
   */
  calculatePositionSize(userId, settings, confidence, volatility = 1) {
    try {
      const baseAmount = settings?.default_trade_amount || 5;
      const maxAmount = settings?.max_trade_amount || 20;
      const riskPerTrade = settings?.max_position_size_percent || 5; // % of account

      // Adjust for confidence (higher confidence = larger position)
      const confidenceMultiplier = Math.min(2.0, 0.5 + (confidence / 100));

      // Adjust for volatility (higher volatility = smaller position)
      const volatilityMultiplier = Math.max(0.3, 1 - (volatility - 1) * 0.5);

      // Calculate position size
      let positionSize = baseAmount * confidenceMultiplier * volatilityMultiplier;

      // Apply risk limits
      const maxRiskAmount = this.calculateMaxRiskAmount(userId, settings);
      positionSize = Math.min(positionSize, maxRiskAmount);

      // Ensure within bounds
      positionSize = Math.max(1, Math.min(positionSize, maxAmount));

      // Round to nearest dollar
      positionSize = Math.round(positionSize);

      this.logger.debug('Position size calculated', {
        userId,
        baseAmount,
        confidence,
        volatility,
        positionSize
      });

      return positionSize;

    } catch (error) {
      this.logger.error('Failed to calculate position size', { userId, error: error.message });
      return settings?.default_trade_amount || 5;
    }
  }

  /**
   * Calculate maximum risk amount per trade
   */
  calculateMaxRiskAmount(userId, settings) {
    try {
      // This would typically use account balance
      // For now, use fixed amounts based on settings
      const maxPercent = settings?.max_position_size_percent || 5;
      const assumedBalance = 1000; // Would get from balance manager

      return (assumedBalance * maxPercent) / 100;

    } catch (error) {
      this.logger.error('Failed to calculate max risk amount', { userId, error: error.message });
      return 10; // Safe default
    }
  }

  /**
   * Adjust position size for asset type
   */
  adjustForAssetType(positionSize, assetType) {
    const multipliers = {
      stock: 1.0,
      forex: 0.8,
      crypto: 0.6
    };

    return positionSize * (multipliers[assetType] || 1.0);
  }

  /**
   * Adjust position size for market conditions
   */
  adjustForMarketConditions(positionSize, conditions) {
    let multiplier = 1.0;

    // Reduce size in high volatility
    if (conditions.volatility > 2) {
      multiplier *= 0.7;
    }

    // Reduce size during news events
    if (conditions.newsImpact > 0.7) {
      multiplier *= 0.8;
    }

    // Reduce size in low liquidity
    if (conditions.liquidity < 0.3) {
      multiplier *= 0.6;
    }

    return positionSize * multiplier;
  }

  /**
   * Calculate Kelly Criterion position size
   */
  calculateKellySize(winRate, avgWin, avgLoss) {
    try {
      if (winRate <= 0 || winRate >= 1 || avgLoss === 0) {
        return 0.02; // 2% default
      }

      const kellyFraction = (winRate * (avgWin / avgLoss)) - (1 - winRate);
      const kellyPercent = Math.max(0.005, Math.min(0.05, kellyFraction)); // 0.5% to 5%

      return kellyPercent;

    } catch (error) {
      this.logger.error('Failed to calculate Kelly size', { error: error.message });
      return 0.02;
    }
  }

  /**
   * Calculate fixed fractional position size
   */
  calculateFixedFractional(accountBalance, riskPerTrade = 0.01) {
    return accountBalance * riskPerTrade;
  }

  /**
   * Calculate optimal f position size based on recent performance
   */
  async calculateOptimalSize(userId, settings) {
    try {
      if (!this.database) return settings?.default_trade_amount || 5;

      const Trade = this.database.getModel('Trade');

      // Get recent trades (last 20)
      const recentTrades = await Trade.findAll({
        where: { user_id: userId, status: 'CLOSED' },
        order: [['created_at', 'DESC']],
        limit: 20
      });

      if (recentTrades.length < 5) {
        return settings?.default_trade_amount || 5;
      }

      // Calculate win rate and average win/loss
      let wins = 0, totalProfit = 0, totalLoss = 0;
      for (const trade of recentTrades) {
        if (trade.result === 'WIN') {
          wins++;
          totalProfit += trade.profit_loss;
        } else if (trade.result === 'LOSS') {
          totalLoss += trade.amount;
        }
      }

      const winRate = wins / recentTrades.length;
      const avgWin = wins > 0 ? totalProfit / wins : 0;
      const avgLoss = (recentTrades.length - wins) > 0 ? totalLoss / (recentTrades.length - wins) : 1;

      // Use Kelly criterion
      const kellySize = this.calculateKellySize(winRate, avgWin, avgLoss);
      const accountBalance = 1000; // Would get from balance manager
      const positionSize = accountBalance * kellySize;

      // Apply bounds
      const minSize = 1;
      const maxSize = settings?.max_trade_amount || 20;

      return Math.max(minSize, Math.min(maxSize, positionSize));

    } catch (error) {
      this.logger.error('Failed to calculate optimal size', { userId, error: error.message });
      return settings?.default_trade_amount || 5;
    }
  }

  /**
   * Validate position size
   */
  validatePositionSize(amount, settings) {
    const minAmount = 1;
    const maxAmount = settings?.max_trade_amount || 20;

    return {
      valid: amount >= minAmount && amount <= maxAmount,
      min: minAmount,
      max: maxAmount,
      suggested: Math.min(maxAmount, Math.max(minAmount, amount))
    };
  }

  /**
   * Get position sizing recommendations
   */
  getSizingRecommendations(userId, settings) {
    return {
      conservative: Math.min(5, settings?.max_trade_amount * 0.5 || 5),
      moderate: settings?.default_trade_amount || 5,
      aggressive: Math.min(15, settings?.max_trade_amount * 0.75 || 10),
      current: settings?.default_trade_amount || 5
    };
  }

  /**
   * Calculate position size for multiple assets
   */
  calculatePortfolioAllocation(totalAmount, assets) {
    // Equal weight allocation
    const perAsset = totalAmount / assets.length;

    return assets.map(asset => ({
      symbol: asset,
      amount: Math.round(perAsset * 100) / 100
    }));
  }

  /**
   * Adjust for correlation
   */
  adjustForCorrelation(positionSizes, correlations) {
    // Reduce sizes for highly correlated assets
    // This is a simplified implementation
    return positionSizes.map(size => ({
      ...size,
      adjustedAmount: size.amount * 0.8 // Reduce by 20% for correlation
    }));
  }

  /**
   * Log position sizing decision
   */
  logSizingDecision(userId, decision) {
    this.logger.info('Position sizing decision', {
      userId,
      ...decision
    });
  }
}

module.exports = PositionSizer;