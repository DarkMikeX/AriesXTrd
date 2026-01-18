/**
 * Average True Range (ATR) Indicator
 * Volatility indicator measuring price movement range
 */

const Calculator = require('../utils/Calculator');

class ATR {
  constructor(period = 14) {
    this.period = period;
  }

  /**
   * Calculate ATR for high, low, close prices
   */
  calculate(highs, lows, closes) {
    if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) {
      return {
        atr: null,
        signal: 'insufficient_data',
        strength: 0,
        volatility: 'unknown'
      };
    }

    if (highs.length < this.period + 1 || lows.length < this.period + 1 || closes.length < this.period + 1) {
      return {
        atr: null,
        signal: 'insufficient_data',
        strength: 0,
        volatility: 'unknown'
      };
    }

    const atr = Calculator.calculateATR(highs, lows, closes, this.period);

    if (atr === null) {
      return {
        atr: null,
        signal: 'insufficient_data',
        strength: 0,
        volatility: 'unknown'
      };
    }

    // Analyze ATR signals
    const analysis = this.analyzeATR(atr, highs, lows, closes);

    return {
      atr: parseFloat(atr.toFixed(6)),
      ...analysis,
      period: this.period
    };
  }

  /**
   * Analyze ATR signals
   */
  analyzeATR(atr, highs, lows, closes) {
    if (atr === null || highs.length < 2 || lows.length < 2) {
      return {
        signal: 'insufficient_data',
        strength: 0,
        volatility: 'unknown',
        description: 'Not enough data to analyze ATR'
      };
    }

    // Calculate current true range for comparison
    const currentHigh = highs[highs.length - 1];
    const currentLow = lows[lows.length - 1];
    const previousClose = closes[closes.length - 2];

    const currentTR = Math.max(
      currentHigh - currentLow,
      Math.abs(currentHigh - previousClose),
      Math.abs(currentLow - previousClose)
    );

    const atrRatio = currentTR / atr;

    let signal = 'neutral';
    let strength = 0;
    let volatility = 'normal';
    let description = '';

    // Analyze volatility based on ATR ratio
    if (atrRatio > 2.5) {
      signal = 'high_volatility_spike';
      strength = Math.min(4, Math.floor(atrRatio));
      volatility = 'very_high';
      description = `True Range (${currentTR.toFixed(4)}) is ${atrRatio.toFixed(1)}x ATR - extreme volatility`;
    } else if (atrRatio > 1.8) {
      signal = 'increased_volatility';
      strength = Math.min(3, Math.floor(atrRatio));
      volatility = 'high';
      description = `True Range (${currentTR.toFixed(4)}) is ${atrRatio.toFixed(1)}x ATR - high volatility`;
    } else if (atrRatio > 1.3) {
      signal = 'moderate_volatility';
      strength = Math.min(2, Math.floor(atrRatio));
      volatility = 'moderate';
      description = `True Range (${currentTR.toFixed(4)}) is ${atrRatio.toFixed(1)}x ATR - moderate volatility`;
    } else if (atrRatio < 0.7) {
      signal = 'low_volatility';
      strength = Math.floor((1 - atrRatio) * 5);
      volatility = 'low';
      description = `True Range (${currentTR.toFixed(4)}) is ${atrRatio.toFixed(1)}x ATR - low volatility`;
    } else {
      signal = 'normal_volatility';
      strength = 0;
      volatility = 'normal';
      description = `True Range (${currentTR.toFixed(4)}) is ${atrRatio.toFixed(1)}x ATR - normal volatility`;
    }

    // Calculate ATR trend
    const atrTrend = this.calculateATRTrend(highs, lows, closes, this.period);

    return {
      signal,
      strength,
      volatility,
      description,
      current_tr: parseFloat(currentTR.toFixed(6)),
      atr_ratio: parseFloat(atrRatio.toFixed(2)),
      trend: atrTrend,
      average_range: parseFloat(atr.toFixed(6))
    };
  }

  /**
   * Calculate ATR trend (increasing or decreasing volatility)
   */
  calculateATRTrend(highs, lows, closes, period, lookback = 5) {
    if (highs.length < period + lookback || lows.length < period + lookback) {
      return 'unknown';
    }

    const atrs = [];
    for (let i = lookback; i >= 0; i--) {
      const sliceHighs = highs.slice(i, i + period + 1);
      const sliceLows = lows.slice(i, i + period + 1);
      const sliceCloses = closes.slice(i, i + period + 1);

      const atr = Calculator.calculateATR(sliceHighs, sliceLows, sliceCloses, period);
      if (atr !== null) atrs.push(atr);
    }

    if (atrs.length < 2) return 'unknown';

    const recentATR = atrs[atrs.length - 1];
    const olderATR = atrs[0];

    const change = ((recentATR - olderATR) / olderATR) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Get ATR signal description
   */
  getSignalDescription(signal) {
    const descriptions = {
      'high_volatility_spike': 'ATR indicates extreme volatility spike - high uncertainty',
      'increased_volatility': 'ATR shows increased volatility - potential trend continuation',
      'moderate_volatility': 'ATR indicates moderate volatility increase',
      'low_volatility': 'ATR shows low volatility - potential breakout preparation',
      'normal_volatility': 'ATR indicates normal volatility levels',
      'insufficient_data': 'Not enough data to calculate ATR'
    };

    return descriptions[signal] || 'Unknown ATR signal';
  }

  /**
   * Get ATR interpretation
   */
  getInterpretation(atr, currentTR, volatility) {
    if (atr === null) return 'Insufficient data';

    const ratio = currentTR / atr;

    if (ratio > 2) {
      return `Current volatility (${ratio.toFixed(1)}x ATR) is extremely high - expect large price swings`;
    } else if (ratio > 1.5) {
      return `Current volatility (${ratio.toFixed(1)}x ATR) is elevated - trend likely to continue`;
    } else if (ratio < 0.8) {
      return `Current volatility (${ratio.toFixed(1)}x ATR) is low - potential for breakout`;
    }

    return `ATR at ${atr.toFixed(6)} - volatility within normal range`;
  }

  /**
   * Get recommended action based on ATR
   */
  getRecommendedAction(atr, currentTR, volatility) {
    if (atr === null) {
      return { action: 'wait', confidence: 0 };
    }

    const ratio = currentTR / atr;

    // High volatility - be cautious
    if (ratio > 2) {
      return {
        action: 'wait',
        confidence: 20,
        reason: 'Extreme volatility - avoid entering new positions'
      };
    }

    // Increased volatility - potential trend continuation
    if (ratio > 1.5) {
      return {
        action: 'hold',
        confidence: 40,
        reason: 'High volatility suggests strong trend - consider trend-following'
      };
    }

    // Low volatility - potential breakout
    if (ratio < 0.8) {
      return {
        action: 'alert',
        confidence: 35,
        reason: 'Low volatility often precedes breakouts - monitor closely'
      };
    }

    // Normal volatility
    return {
      action: 'normal',
      confidence: 25,
      reason: 'Normal volatility - standard trading conditions'
    };
  }

  /**
   * Calculate position size based on ATR (volatility-adjusted)
   */
  static calculatePositionSize(accountBalance, riskPercent, atr, currentPrice, stopLossMultiplier = 2) {
    if (!atr || !currentPrice || currentPrice === 0) return 0;

    // Calculate stop loss distance based on ATR
    const stopLossDistance = atr * stopLossMultiplier;

    // Calculate position size based on risk
    const riskAmount = accountBalance * (riskPercent / 100);
    const positionSize = riskAmount / stopLossDistance;

    // Convert to number of units (simplified)
    return Math.floor(positionSize);
  }

  /**
   * Get ATR-based stop loss level
   */
  static getStopLossLevel(entryPrice, atr, multiplier = 2, direction = 'long') {
    if (!atr || !entryPrice) return null;

    const stopDistance = atr * multiplier;

    if (direction === 'long') {
      return entryPrice - stopDistance;
    } else {
      return entryPrice + stopDistance;
    }
  }

  /**
   * Get ATR-based take profit level
   */
  static getTakeProfitLevel(entryPrice, atr, riskRewardRatio = 2, direction = 'long') {
    if (!atr || !entryPrice) return null;

    const profitDistance = atr * riskRewardRatio;

    if (direction === 'long') {
      return entryPrice + profitDistance;
    } else {
      return entryPrice - profitDistance;
    }
  }

  /**
   * Detect volatility contraction/expansion
   */
  detectVolatilityPattern(highs, lows, closes, lookback = 10) {
    if (highs.length < this.period + lookback) return null;

    const recentATR = Calculator.calculateATR(highs, lows, closes, this.period);
    const olderHighs = highs.slice(0, -lookback);
    const olderLows = lows.slice(0, -lookback);
    const olderCloses = closes.slice(0, -lookback);

    const olderATR = Calculator.calculateATR(olderHighs, olderLows, olderCloses, this.period);

    if (!recentATR || !olderATR) return null;

    const ratio = recentATR / olderATR;

    if (ratio < 0.7) {
      return {
        pattern: 'contraction',
        strength: Math.floor((1 - ratio) * 100),
        description: 'ATR decreasing - volatility contraction, potential breakout setup'
      };
    } else if (ratio > 1.3) {
      return {
        pattern: 'expansion',
        strength: Math.floor((ratio - 1) * 100),
        description: 'ATR increasing - volatility expansion, strong trend in progress'
      };
    }

    return {
      pattern: 'stable',
      strength: 0,
      description: 'ATR stable - normal volatility conditions'
    };
  }

  /**
   * Validate ATR parameters
   */
  validate() {
    if (!Number.isInteger(this.period) || this.period < 2 || this.period > 100) {
      throw new Error('ATR period must be an integer between 2 and 100');
    }
    return true;
  }

  /**
   * Get indicator metadata
   */
  getMetadata() {
    return {
      name: 'Average True Range',
      abbreviation: 'ATR',
      category: 'volatility',
      description: 'Volatility indicator measuring the average range of price movement',
      period: this.period,
      range: { min: 0, max: 'unlimited' },
      signals: ['high_volatility_spike', 'increased_volatility', 'low_volatility'],
      reliability: 'high',
      usage: 'Used to measure volatility and set stop losses/take profits'
    };
  }

  /**
   * Get optimal ATR periods for different timeframes
   */
  static getOptimalPeriod(timeframe) {
    const periods = {
      '1m': 10,
      '5m': 14,
      '15m': 14,
      '30m': 14,
      '1H': 14,
      '4H': 20,
      '1D': 14,
      '1W': 20
    };

    return periods[timeframe] || 14;
  }

  /**
   * Calculate ATR for multiple periods
   */
  static calculateMultipleATR(highs, lows, closes, periods = [7, 14, 21]) {
    const results = {};

    periods.forEach(period => {
      const atr = Calculator.calculateATR(highs, lows, closes, period);
      results[`atr_${period}`] = atr ? parseFloat(atr.toFixed(6)) : null;
    });

    return results;
  }
}

module.exports = ATR;