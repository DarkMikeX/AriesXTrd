/**
 * Binary Strategy
 * Specialized strategy for binary options trading
 */

const Logger = require('../utils/Logger');

class BinaryStrategy {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Analyze for binary options
   */
  async analyze(marketData, options = {}) {
    const { closes, highs, lows, volumes } = marketData;
    const expiryMinutes = options.expiryMinutes || 5;

    // Binary options specific analysis
    const shortTermMomentum = this.calculateShortTermMomentum(closes, 3);
    const supportResistance = this.checkSupportResistance(closes, highs, lows);
    const volumeConfirmation = this.checkVolumeConfirmation(volumes);

    // Time-based analysis for short expiry
    const timeFactor = this.getTimeFactor(expiryMinutes);

    let signal = 'WAIT';
    let confidence = 0;
    let reasoning = '';

    // Strong momentum in direction of support/resistance
    if (Math.abs(shortTermMomentum) > 0.001) {
      const directionAligned = (shortTermMomentum > 0 && supportResistance.nearResistance) ||
                              (shortTermMomentum < 0 && supportResistance.nearSupport);

      if (directionAligned && volumeConfirmation) {
        signal = shortTermMomentum > 0 ? 'BUY' : 'SELL';
        confidence = Math.min(95, Math.abs(shortTermMomentum) * 30000 * timeFactor);
        reasoning = `Strong momentum towards ${shortTermMomentum > 0 ? 'resistance' : 'support'} with volume confirmation`;
      }
    }

    // Reversal signals at key levels
    if (supportResistance.atKeyLevel && volumeConfirmation) {
      signal = supportResistance.nearResistance ? 'SELL' : 'BUY';
      confidence = Math.min(85, 60 + volumeConfirmation * 20);
      reasoning = `Potential reversal at ${supportResistance.nearResistance ? 'resistance' : 'support'} level`;
    }

    return {
      signal,
      type: signal === 'BUY' ? 'CALL' : signal === 'SELL' ? 'PUT' : 'NONE',
      confidence: Math.round(confidence),
      strength: confidence > 80 ? 'STRONG' : confidence > 60 ? 'MODERATE' : 'WEAK',
      reasoning,
      binarySpecific: {
        expiryMinutes,
        timeFactor: timeFactor.toFixed(2),
        shortTermMomentum: shortTermMomentum.toFixed(6),
        supportResistance,
        volumeConfirmation
      }
    };
  }

  /**
   * Calculate short-term momentum for binary options
   */
  calculateShortTermMomentum(closes, periods = 3) {
    if (!closes || closes.length < periods + 1) return 0;

    const recent = closes.slice(-periods);
    const previous = closes.slice(-periods - periods, -periods);

    if (recent.length === 0 || previous.length === 0) return 0;

    const recentAvg = recent.reduce((sum, price) => sum + price, 0) / recent.length;
    const previousAvg = previous.reduce((sum, price) => sum + price, 0) / previous.length;

    return (recentAvg - previousAvg) / previousAvg;
  }

  /**
   * Check support and resistance levels
   */
  checkSupportResistance(closes, highs, lows, lookback = 20) {
    if (!closes || closes.length < lookback) {
      return { nearSupport: false, nearResistance: false, atKeyLevel: false };
    }

    const recent = closes.slice(-lookback);
    const current = closes[closes.length - 1];

    // Simple support/resistance calculation
    const sorted = [...recent].sort((a, b) => a - b);
    const support = sorted[Math.floor(sorted.length * 0.2)]; // 20th percentile
    const resistance = sorted[Math.floor(sorted.length * 0.8)]; // 80th percentile

    const range = resistance - support;
    const nearSupport = Math.abs(current - support) / range < 0.05;
    const nearResistance = Math.abs(current - resistance) / range < 0.05;

    return {
      nearSupport,
      nearResistance,
      atKeyLevel: nearSupport || nearResistance,
      support: support.toFixed(4),
      resistance: resistance.toFixed(4),
      distanceFromSupport: ((current - support) / range * 100).toFixed(1) + '%',
      distanceFromResistance: ((resistance - current) / range * 100).toFixed(1) + '%'
    };
  }

  /**
   * Check volume confirmation
   */
  checkVolumeConfirmation(volumes, periods = 5) {
    if (!volumes || volumes.length < periods * 2) return 0;

    const recent = volumes.slice(-periods);
    const previous = volumes.slice(-periods * 2, -periods);

    const recentAvg = recent.reduce((sum, vol) => sum + vol, 0) / recent.length;
    const previousAvg = previous.reduce((sum, vol) => sum + vol, 0) / previous.length;

    // Volume should be increasing for confirmation
    const volumeRatio = recentAvg / previousAvg;

    return Math.min(100, Math.max(0, (volumeRatio - 0.8) * 100));
  }

  /**
   * Get time factor for binary options
   */
  getTimeFactor(expiryMinutes) {
    // Shorter expiry = higher time decay = lower confidence
    // Longer expiry = more time for price movement = higher confidence

    if (expiryMinutes <= 1) return 0.7; // 1 minute - very fast
    if (expiryMinutes <= 5) return 1.0; // 5 minutes - optimal
    if (expiryMinutes <= 15) return 0.9; // 15 minutes - good
    if (expiryMinutes <= 30) return 0.8; // 30 minutes - moderate
    return 0.6; // 60+ minutes - longer term
  }

  /**
   * Calculate optimal expiry time
   */
  getOptimalExpiry(marketData) {
    const volatility = this.calculateVolatility(marketData.highs, marketData.lows, marketData.closes);

    // Higher volatility = shorter expiry
    if (volatility > 0.05) return 1; // 1 minute
    if (volatility > 0.02) return 5; // 5 minutes
    if (volatility > 0.01) return 15; // 15 minutes
    return 30; // 30 minutes for low volatility
  }

  /**
   * Get binary options risk parameters
   */
  getRiskParameters() {
    return {
      maxPositionSize: 0.02, // 2% of portfolio per trade
      maxConcurrentTrades: 3, // Maximum 3 open positions
      maxDailyTrades: 20,
      stopLoss: 0.5, // 50% of trade amount (binary options are all or nothing)
      takeProfit: 0.95, // 95% payout target
      coolingPeriod: 30, // 30 seconds between trades
      expiryRange: { min: 1, max: 60 } // 1-60 minutes
    };
  }

  /**
   * Validate binary options trading conditions
   */
  validateConditions(marketData, expiryMinutes = 5) {
    const issues = [];

    if (!marketData.closes || marketData.closes.length < 10) {
      issues.push('Insufficient price data for binary analysis');
    }

    if (expiryMinutes < 1 || expiryMinutes > 60) {
      issues.push('Invalid expiry time for binary options');
    }

    // Check for sufficient liquidity
    const volumeConfirmation = this.checkVolumeConfirmation(marketData.volumes);
    if (volumeConfirmation < 30) {
      issues.push('Low volume may affect trade execution');
    }

    // Check for extreme volatility that might cause early closure
    const volatility = this.calculateVolatility(marketData.highs, marketData.lows, marketData.closes);
    if (volatility > 0.1) {
      issues.push('Extreme volatility may cause early position closure');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Calculate volatility for binary options
   */
  calculateVolatility(highs, lows, closes) {
    if (!closes || closes.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]));
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Get binary options payout estimation
   */
  estimatePayout(amount, confidence) {
    // Typical binary options payout is 70-95%
    const basePayout = 0.75; // 75% base payout
    const confidenceBonus = (confidence - 50) * 0.002; // Bonus based on confidence

    const payoutRate = Math.min(0.95, Math.max(0.70, basePayout + confidenceBonus));
    const payout = amount * payoutRate;

    return {
      payoutRate: (payoutRate * 100).toFixed(1) + '%',
      payoutAmount: payout.toFixed(2),
      netProfit: (payout - amount).toFixed(2)
    };
  }
}

module.exports = BinaryStrategy;