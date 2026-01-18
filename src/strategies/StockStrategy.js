/**
 * Stock Strategy
 * Specialized trading strategy for stocks
 */

const Logger = require('../utils/Logger');

class StockStrategy {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Analyze stock market conditions
   */
  async analyze(marketData, options = {}) {
    const { highs, lows, closes, volumes } = marketData;

    // Stock-specific analysis
    const volatility = this.calculateVolatility(highs, lows, closes);
    const volumeTrend = this.analyzeVolumeTrend(volumes);
    const momentum = this.calculateMomentum(closes);

    // Generate stock-specific signals
    let signal = 'WAIT';
    let confidence = 0;
    let reasoning = '';

    // High volatility + strong volume = potential breakout
    if (volatility > 0.02 && volumeTrend === 'increasing') {
      signal = momentum > 0 ? 'BUY' : 'SELL';
      confidence = Math.min(80, volatility * 2000 + volumeTrend.strength * 20);
      reasoning = 'High volatility breakout with volume confirmation';
    }
    // Low volatility = ranging market
    else if (volatility < 0.01) {
      signal = 'WAIT';
      reasoning = 'Low volatility ranging market';
    }
    // Moderate conditions
    else {
      signal = momentum > 0.5 ? 'BUY' : momentum < -0.5 ? 'SELL' : 'WAIT';
      confidence = Math.abs(momentum) * 60;
      reasoning = 'Moderate market conditions';
    }

    return {
      signal,
      type: signal === 'BUY' ? 'CALL' : signal === 'SELL' ? 'PUT' : 'NONE',
      confidence: Math.round(confidence),
      strength: confidence > 70 ? 'STRONG' : confidence > 50 ? 'MODERATE' : 'WEAK',
      reasoning,
      marketConditions: {
        volatility: volatility.toFixed(4),
        volumeTrend,
        momentum: momentum.toFixed(4)
      }
    };
  }

  /**
   * Calculate stock volatility
   */
  calculateVolatility(highs, lows, closes) {
    if (!closes || closes.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Analyze volume trend
   */
  analyzeVolumeTrend(volumes) {
    if (!volumes || volumes.length < 10) return { trend: 'insufficient_data', strength: 0 };

    const recent = volumes.slice(-5);
    const previous = volumes.slice(-10, -5);

    const recentAvg = recent.reduce((sum, vol) => sum + vol, 0) / recent.length;
    const previousAvg = previous.reduce((sum, vol) => sum + vol, 0) / previous.length;

    const change = (recentAvg - previousAvg) / previousAvg;

    if (change > 0.2) {
      return { trend: 'increasing', strength: Math.min(100, change * 100) };
    } else if (change < -0.2) {
      return { trend: 'decreasing', strength: Math.min(100, Math.abs(change) * 100) };
    } else {
      return { trend: 'stable', strength: 0 };
    }
  }

  /**
   * Calculate momentum
   */
  calculateMomentum(closes, period = 10) {
    if (!closes || closes.length < period + 1) return 0;

    const current = closes[closes.length - 1];
    const past = closes[closes.length - period - 1];

    return (current - past) / past;
  }

  /**
   * Get stock-specific risk parameters
   */
  getRiskParameters() {
    return {
      maxPositionSize: 0.05, // 5% of portfolio
      stopLoss: 0.02, // 2% stop loss
      takeProfit: 0.05, // 5% take profit
      maxDailyTrades: 10,
      volatilityMultiplier: 1.2
    };
  }

  /**
   * Validate stock trading conditions
   */
  validateConditions(marketData) {
    const issues = [];

    if (!marketData.closes || marketData.closes.length < 50) {
      issues.push('Insufficient price data');
    }

    if (!marketData.volumes || marketData.volumes.length < 50) {
      issues.push('Insufficient volume data');
    }

    // Check for extreme volatility
    const volatility = this.calculateVolatility(marketData.highs, marketData.lows, marketData.closes);
    if (volatility > 0.1) {
      issues.push('Extreme volatility detected');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = StockStrategy;