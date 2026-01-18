/**
 * Forex Strategy
 * Specialized trading strategy for forex pairs
 */

const Logger = require('../utils/Logger');

class ForexStrategy {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Analyze forex market conditions
   */
  async analyze(marketData, options = {}) {
    const { highs, lows, closes, volumes } = marketData;

    // Forex-specific analysis
    const pipMovement = this.calculatePipMovement(highs, lows, closes);
    const spread = this.estimateSpread(closes);
    const trendStrength = this.calculateTrendStrength(closes);

    // Generate forex-specific signals
    let signal = 'WAIT';
    let confidence = 0;
    let reasoning = '';

    // Strong trend + reasonable spread
    if (trendStrength > 0.001 && spread < pipMovement * 0.1) {
      signal = trendStrength > 0 ? 'BUY' : 'SELL';
      confidence = Math.min(85, Math.abs(trendStrength) * 50000);
      reasoning = 'Strong trend with favorable spread';
    }
    // Range-bound market
    else if (pipMovement < 0.0005) {
      signal = 'WAIT';
      reasoning = 'Range-bound market conditions';
    }
    // Weak trend or high spread
    else {
      signal = Math.abs(trendStrength) > 0.0005 ?
               (trendStrength > 0 ? 'BUY' : 'SELL') : 'WAIT';
      confidence = Math.max(0, Math.abs(trendStrength) * 30000 - spread * 1000);
      reasoning = 'Weak trend or high spread conditions';
    }

    return {
      signal,
      type: signal === 'BUY' ? 'CALL' : signal === 'SELL' ? 'PUT' : 'NONE',
      confidence: Math.round(confidence),
      strength: confidence > 70 ? 'STRONG' : confidence > 50 ? 'MODERATE' : 'WEAK',
      reasoning,
      marketConditions: {
        pipMovement: pipMovement.toFixed(6),
        spread: spread.toFixed(6),
        trendStrength: trendStrength.toFixed(6)
      }
    };
  }

  /**
   * Calculate pip movement
   */
  calculatePipMovement(highs, lows, closes) {
    if (!closes || closes.length < 2) return 0;

    const movements = [];
    for (let i = 1; i < closes.length; i++) {
      movements.push(Math.abs(closes[i] - closes[i - 1]));
    }

    return movements.reduce((sum, move) => sum + move, 0) / movements.length;
  }

  /**
   * Estimate spread
   */
  estimateSpread(closes, periods = 10) {
    if (!closes || closes.length < periods) return 0.0001; // Default 1 pip

    // Estimate spread based on price action
    const recent = closes.slice(-periods);
    const volatility = this.calculateVolatility([], [], recent);

    // Typical spread is 0.1% of volatility for major pairs
    return Math.max(0.00001, volatility * 0.001);
  }

  /**
   * Calculate trend strength
   */
  calculateTrendStrength(closes, period = 20) {
    if (!closes || closes.length < period) return 0;

    const smaShort = this.calculateSMA(closes, Math.floor(period / 2));
    const smaLong = this.calculateSMA(closes, period);

    if (!smaShort || !smaLong) return 0;

    return (smaShort - smaLong) / smaLong;
  }

  /**
   * Calculate simple moving average
   */
  calculateSMA(data, period) {
    if (!data || data.length < period) return null;

    const slice = data.slice(-period);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  }

  /**
   * Calculate volatility
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
   * Get forex-specific risk parameters
   */
  getRiskParameters() {
    return {
      maxPositionSize: 0.02, // 2% of portfolio
      stopLoss: 0.005, // 0.5% stop loss (50 pips)
      takeProfit: 0.01, // 1% take profit (100 pips)
      maxDailyTrades: 15,
      leverageMultiplier: 1.5
    };
  }

  /**
   * Validate forex trading conditions
   */
  validateConditions(marketData) {
    const issues = [];

    if (!marketData.closes || marketData.closes.length < 100) {
      issues.push('Insufficient price data for forex analysis');
    }

    // Check for weekend gaps (forex is 24/5)
    const pipMovement = this.calculatePipMovement(marketData.highs, marketData.lows, marketData.closes);
    if (pipMovement > 0.01) {
      issues.push('Extreme pip movement detected');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = ForexStrategy;