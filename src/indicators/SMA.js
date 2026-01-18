/**
 * Simple Moving Average (SMA) Indicator
 * Arithmetic mean of a series of values
 */

const Calculator = require('../utils/Calculator');

class SMA {
  constructor(period = 50) {
    this.period = period;
  }

  /**
   * Calculate SMA for an array of prices
   */
  calculate(prices) {
    if (!Array.isArray(prices) || prices.length < this.period) {
      return {
        sma: null,
        signal: 'insufficient_data',
        strength: 0,
        trend: 'unknown'
      };
    }

    // Convert price objects to numbers if needed
    const priceValues = prices.map(p => typeof p === 'object' ? p.close || p.price : p);

    const sma = Calculator.calculateSMA(priceValues, this.period);

    if (sma === null) {
      return {
        sma: null,
        signal: 'insufficient_data',
        strength: 0,
        trend: 'unknown'
      };
    }

    const currentPrice = priceValues[priceValues.length - 1];

    // Analyze SMA signals
    const analysis = this.analyzeSMA(currentPrice, sma, priceValues);

    return {
      sma: parseFloat(sma.toFixed(4)),
      ...analysis,
      period: this.period
    };
  }

  /**
   * Analyze SMA signals
   */
  analyzeSMA(currentPrice, sma, prices) {
    let signal = 'neutral';
    let strength = 0;
    let trend = 'sideways';
    let description = '';

    // Price vs SMA
    const priceVsSma = currentPrice - sma;
    const percentDiff = Math.abs(priceVsSma / sma) * 100;

    if (priceVsSma > 0) {
      // Price above SMA
      trend = 'bullish';

      if (percentDiff > 3) {
        signal = 'strong_above_sma';
        strength = Math.min(3, Math.floor(percentDiff / 2));
        description = `Price ${percentDiff.toFixed(1)}% above SMA - strong bullish trend`;
      } else if (percentDiff > 1) {
        signal = 'above_sma';
        strength = Math.min(2, Math.floor(percentDiff / 1));
        description = `Price ${percentDiff.toFixed(1)}% above SMA - bullish trend`;
      } else {
        signal = 'slightly_above_sma';
        strength = 1;
        description = 'Price slightly above SMA - mildly bullish';
      }
    } else {
      // Price below SMA
      trend = 'bearish';

      if (percentDiff > 3) {
        signal = 'strong_below_sma';
        strength = Math.min(3, Math.floor(percentDiff / 2));
        description = `Price ${percentDiff.toFixed(1)}% below SMA - strong bearish trend`;
      } else if (percentDiff > 1) {
        signal = 'below_sma';
        strength = Math.min(2, Math.floor(percentDiff / 1));
        description = `Price ${percentDiff.toFixed(1)}% below SMA - bearish trend`;
      } else {
        signal = 'slightly_below_sma';
        strength = 1;
        description = 'Price slightly below SMA - mildly bearish';
      }
    }

    // Check for SMA slope (trend strength)
    const smaSlope = this.calculateSMASlope(prices, this.period);
    const slopeStrength = Math.abs(smaSlope);

    if (slopeStrength > 0.3) {
      trend = smaSlope > 0 ? 'strong_bullish' : 'strong_bearish';
    }

    return {
      signal,
      strength,
      trend,
      description,
      price_vs_sma: parseFloat(priceVsSma.toFixed(4)),
      percent_diff: parseFloat(percentDiff.toFixed(2)),
      slope: parseFloat(smaSlope.toFixed(6)),
      slope_strength: parseFloat(slopeStrength.toFixed(4))
    };
  }

  /**
   * Calculate SMA slope (rate of change)
   */
  calculateSMASlope(prices, period, lookback = 5) {
    if (prices.length < period + lookback) return 0;

    const smas = [];
    for (let i = lookback; i >= 0; i--) {
      const slice = prices.slice(i, i + period);
      const sma = Calculator.calculateSMA(slice, period);
      if (sma !== null) smas.push(sma);
    }

    if (smas.length < 2) return 0;

    // Calculate slope using linear regression
    const n = smas.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = smas.reduce((sum, sma) => sum + sma, 0);
    const sumXY = smas.reduce((sum, sma, i) => sum + (sma * i), 0);
    const sumXX = smas.reduce((sum, sma, i) => sum + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    return slope || 0;
  }

  /**
   * Get SMA signal description
   */
  getSignalDescription(signal) {
    const descriptions = {
      'strong_above_sma': 'Price significantly above SMA - strong uptrend',
      'above_sma': 'Price above SMA - uptrend confirmed',
      'slightly_above_sma': 'Price slightly above SMA - mild uptrend',
      'strong_below_sma': 'Price significantly below SMA - strong downtrend',
      'below_sma': 'Price below SMA - downtrend confirmed',
      'slightly_below_sma': 'Price slightly below SMA - mild downtrend',
      'neutral': 'Price around SMA - no clear trend',
      'insufficient_data': 'Not enough data to calculate SMA'
    };

    return descriptions[signal] || 'Unknown SMA signal';
  }

  /**
   * Get SMA interpretation
   */
  getInterpretation(price, sma, trend) {
    if (sma === null) return 'Insufficient data';

    const diff = ((price - sma) / sma * 100);

    if (Math.abs(diff) < 0.1) {
      return 'Price very close to SMA - consolidation phase';
    } else if (diff > 3) {
      return `Price ${diff.toFixed(1)}% above SMA - strong uptrend`;
    } else if (diff > 1) {
      return `Price ${diff.toFixed(1)}% above SMA - uptrend`;
    } else if (diff < -3) {
      return `Price ${Math.abs(diff).toFixed(1)}% below SMA - strong downtrend`;
    } else if (diff < -1) {
      return `Price ${Math.abs(diff).toFixed(1)}% below SMA - downtrend`;
    }

    return 'Price near SMA - wait for clearer direction';
  }

  /**
   * Get recommended action based on SMA
   */
  getRecommendedAction(currentPrice, sma, trend) {
    if (sma === null) {
      return { action: 'wait', confidence: 0 };
    }

    const diff = ((currentPrice - sma) / sma) * 100;

    // Strong bullish signals
    if (diff > 3 && trend.includes('bullish')) {
      return {
        action: 'strong_buy',
        confidence: 65,
        reason: 'Price significantly above SMA with bullish trend'
      };
    }

    // Moderate bullish signals
    if (diff > 1.5 && trend.includes('bullish')) {
      return {
        action: 'buy',
        confidence: 50,
        reason: 'Price above SMA with bullish trend'
      };
    }

    // Strong bearish signals
    if (diff < -3 && trend.includes('bearish')) {
      return {
        action: 'strong_sell',
        confidence: 65,
        reason: 'Price significantly below SMA with bearish trend'
      };
    }

    // Moderate bearish signals
    if (diff < -1.5 && trend.includes('bearish')) {
      return {
        action: 'sell',
        confidence: 50,
        reason: 'Price below SMA with bearish trend'
      };
    }

    // Weak signals
    if (diff > 0.8) {
      return {
        action: 'weak_buy',
        confidence: 30,
        reason: 'Price slightly above SMA'
      };
    }

    if (diff < -0.8) {
      return {
        action: 'weak_sell',
        confidence: 30,
        reason: 'Price slightly below SMA'
      };
    }

    // No clear signal
    return {
      action: 'wait',
      confidence: 10,
      reason: 'Price too close to SMA - wait for clearer direction'
    };
  }

  /**
   * Calculate multiple SMAs
   */
  static calculateMultipleSMAs(prices, periods = [50, 100, 200]) {
    const results = {};

    periods.forEach(period => {
      const sma = Calculator.calculateSMA(prices, period);
      results[`sma_${period}`] = sma ? parseFloat(sma.toFixed(4)) : null;
    });

    return results;
  }

  /**
   * Check for SMA crossovers
   */
  static checkSMACrossovers(shortSMA, longSMA, previousShortSMA, previousLongSMA) {
    if (!shortSMA || !longSMA || !previousShortSMA || !previousLongSMA) {
      return { crossover: false, type: null };
    }

    const currentDiff = shortSMA - longSMA;
    const previousDiff = previousShortSMA - previousLongSMA;

    // Check for crossover
    if ((currentDiff > 0 && previousDiff < 0) || (currentDiff < 0 && previousDiff > 0)) {
      return {
        crossover: true,
        type: currentDiff > 0 ? 'bullish' : 'bearish',
        strength: Math.abs(currentDiff - previousDiff)
      };
    }

    return { crossover: false, type: null };
  }

  /**
   * Analyze SMA ribbon (Golden/Death Cross signals)
   */
  static analyzeSMARibbon(smas) {
    // Analyze multiple SMAs for ribbon signals
    const periods = Object.keys(smas).map(key => parseInt(key.split('_')[1])).sort((a, b) => a - b);
    const values = periods.map(period => smas[`sma_${period}`]);

    if (values.some(v => v === null)) {
      return { signal: 'insufficient_data', strength: 0 };
    }

    // Check if SMAs are stacked (bullish) or inverted (bearish)
    let bullishStack = 0;
    let bearishStack = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) bullishStack++;
      else if (values[i] < values[i - 1]) bearishStack++;
    }

    if (bullishStack > bearishStack) {
      return {
        signal: 'bullish_ribbon',
        strength: Math.floor((bullishStack / (periods.length - 1)) * 100),
        description: 'SMAs in bullish alignment'
      };
    } else if (bearishStack > bullishStack) {
      return {
        signal: 'bearish_ribbon',
        strength: Math.floor((bearishStack / (periods.length - 1)) * 100),
        description: 'SMAs in bearish alignment'
      };
    }

    return {
      signal: 'neutral_ribbon',
      strength: 50,
      description: 'SMAs mixed - no clear direction'
    };
  }

  /**
   * Get support/resistance levels from SMA
   */
  static getSupportResistance(sma, currentPrice, threshold = 0.005) {
    const support = sma * (1 - threshold);
    const resistance = sma * (1 + threshold);

    return {
      support,
      resistance,
      is_support: currentPrice <= support,
      is_resistance: currentPrice >= resistance,
      distance_to_support: ((currentPrice - support) / support) * 100,
      distance_to_resistance: ((resistance - currentPrice) / resistance) * 100
    };
  }

  /**
   * Validate SMA parameters
   */
  validate() {
    if (!Number.isInteger(this.period) || this.period < 2 || this.period > 500) {
      throw new Error('SMA period must be an integer between 2 and 500');
    }
    return true;
  }

  /**
   * Get indicator metadata
   */
  getMetadata() {
    return {
      name: 'Simple Moving Average',
      abbreviation: 'SMA',
      category: 'trend_following',
      description: 'Arithmetic mean of a series of values over a period',
      period: this.period,
      range: 'unlimited',
      signals: ['above_sma', 'below_sma', 'crossover'],
      reliability: 'medium',
      usage: 'Used to identify trend direction and support/resistance levels'
    };
  }

  /**
   * Get optimal SMA periods for different timeframes
   */
  static getOptimalPeriods(timeframe) {
    const periods = {
      '1m': [10, 20, 50],
      '5m': [20, 50, 100],
      '15m': [50, 100, 200],
      '30m': [50, 100, 200],
      '1H': [50, 100, 200],
      '4H': [50, 100, 200],
      '1D': [50, 100, 200],
      '1W': [20, 50, 100]
    };

    return periods[timeframe] || [50, 100, 200];
  }
}

module.exports = SMA;