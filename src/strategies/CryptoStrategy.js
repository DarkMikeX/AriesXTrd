/**
 * Crypto Strategy
 * Specialized trading strategy for cryptocurrencies
 */

const Logger = require('../utils/Logger');

class CryptoStrategy {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Analyze crypto market conditions
   */
  async analyze(marketData, options = {}) {
    const { highs, lows, closes, volumes } = marketData;

    // Crypto-specific analysis
    const volatility = this.calculateVolatility(highs, lows, closes);
    const volumeSpike = this.detectVolumeSpike(volumes);
    const momentum = this.calculateCryptoMomentum(closes);

    // Generate crypto-specific signals
    let signal = 'WAIT';
    let confidence = 0;
    let reasoning = '';

    // High volatility + volume spike = strong signal
    if (volatility > 0.05 && volumeSpike.detected) {
      signal = momentum > 0 ? 'BUY' : 'SELL';
      confidence = Math.min(90, volatility * 1000 + volumeSpike.strength);
      reasoning = 'High volatility with volume spike confirmation';
    }
    // Moderate volatility with momentum
    else if (volatility > 0.02) {
      signal = Math.abs(momentum) > 0.02 ?
               (momentum > 0 ? 'BUY' : 'SELL') : 'WAIT';
      confidence = Math.min(75, Math.abs(momentum) * 2000);
      reasoning = 'Moderate volatility with momentum';
    }
    // Low volatility = accumulation/distribution
    else {
      signal = 'WAIT';
      reasoning = 'Low volatility accumulation phase';
    }

    return {
      signal,
      type: signal === 'BUY' ? 'CALL' : signal === 'SELL' ? 'PUT' : 'NONE',
      confidence: Math.round(confidence),
      strength: confidence > 75 ? 'STRONG' : confidence > 50 ? 'MODERATE' : 'WEAK',
      reasoning,
      marketConditions: {
        volatility: volatility.toFixed(4),
        volumeSpike,
        momentum: momentum.toFixed(4)
      }
    };
  }

  /**
   * Calculate volatility for crypto
   */
  calculateVolatility(highs, lows, closes) {
    if (!closes || closes.length < 2) return 0;

    // Crypto typically has higher volatility than traditional assets
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]));
    }

    // Use higher percentile for crypto volatility
    returns.sort((a, b) => b - a);
    const percentile95 = returns[Math.floor(returns.length * 0.05)];

    return percentile95;
  }

  /**
   * Detect volume spikes in crypto
   */
  detectVolumeSpike(volumes) {
    if (!volumes || volumes.length < 20) {
      return { detected: false, strength: 0 };
    }

    const recent = volumes.slice(-5);
    const historical = volumes.slice(-20, -5);

    const recentAvg = recent.reduce((sum, vol) => sum + vol, 0) / recent.length;
    const historicalAvg = historical.reduce((sum, vol) => sum + vol, 0) / historical.length;

    const ratio = recentAvg / historicalAvg;
    const detected = ratio > 3; // 3x normal volume
    const strength = Math.min(100, (ratio - 1) * 20);

    return {
      detected,
      strength: Math.round(strength),
      ratio: ratio.toFixed(2)
    };
  }

  /**
   * Calculate crypto momentum
   */
  calculateCryptoMomentum(closes, period = 12) {
    if (!closes || closes.length < period + 1) return 0;

    // Crypto momentum often follows exponential curves
    const current = closes[closes.length - 1];
    const past = closes[closes.length - period - 1];

    const linearMomentum = (current - past) / past;

    // Add exponential weighting for recent price action
    const weights = [];
    for (let i = 0; i < period; i++) {
      weights.push(Math.exp(i / period)); // Exponential weighting
    }

    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    let weightedMomentum = 0;

    for (let i = 0; i < period; i++) {
      const price = closes[closes.length - period + i];
      const prevPrice = closes[closes.length - period + i - 1];
      const return_ = prevPrice ? (price - prevPrice) / prevPrice : 0;
      weightedMomentum += return_ * weights[i];
    }

    weightedMomentum /= weightSum;

    return weightedMomentum;
  }

  /**
   * Get crypto-specific risk parameters
   */
  getRiskParameters() {
    return {
      maxPositionSize: 0.03, // 3% of portfolio (higher risk tolerance)
      stopLoss: 0.03, // 3% stop loss
      takeProfit: 0.08, // 8% take profit
      maxDailyTrades: 8,
      volatilityMultiplier: 2.0
    };
  }

  /**
   * Validate crypto trading conditions
   */
  validateConditions(marketData) {
    const issues = [];

    if (!marketData.closes || marketData.closes.length < 50) {
      issues.push('Insufficient price data for crypto analysis');
    }

    // Crypto markets are 24/7, check for data consistency
    const volatility = this.calculateVolatility(marketData.highs, marketData.lows, marketData.closes);
    if (volatility > 0.2) {
      issues.push('Extreme volatility detected - exercise caution');
    }

    // Check for volume consistency
    const volumeSpike = this.detectVolumeSpike(marketData.volumes);
    if (!volumeSpike.detected && marketData.volumes.length > 50) {
      issues.push('Low volume conditions may affect liquidity');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get crypto market regime
   */
  getMarketRegime(marketData) {
    const volatility = this.calculateVolatility(marketData.highs, marketData.lows, marketData.closes);
    const volumeSpike = this.detectVolumeSpike(marketData.volumes);

    if (volatility > 0.1 && volumeSpike.detected) {
      return 'BREAKOUT';
    } else if (volatility > 0.05) {
      return 'TRENDING';
    } else if (volatility < 0.02) {
      return 'ACCUMULATION';
    } else {
      return 'NEUTRAL';
    }
  }
}

module.exports = CryptoStrategy;