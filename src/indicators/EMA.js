/**
 * Exponential Moving Average (EMA) Indicator
 * Gives more weight to recent prices
 */

const Calculator = require('../utils/Calculator');

class EMA {
  constructor(period = 20) {
    this.period = period;
  }

  /**
   * Calculate EMA for an array of prices
   */
  calculate(prices) {
    if (!Array.isArray(prices) || prices.length < this.period) {
      return {
        ema: null,
        signal: 'insufficient_data',
        strength: 0,
        trend: 'unknown'
      };
    }

    // Convert price objects to numbers if needed
    const priceValues = prices.map(p => typeof p === 'object' ? p.close || p.price : p);

    const ema = Calculator.calculateEMA(priceValues, this.period);

    if (ema === null) {
      return {
        ema: null,
        signal: 'insufficient_data',
        strength: 0,
        trend: 'unknown'
      };
    }

    const currentPrice = priceValues[priceValues.length - 1];

    // Analyze EMA signals
    const analysis = this.analyzeEMA(currentPrice, ema, priceValues);

    return {
      ema: parseFloat(ema.toFixed(4)),
      ...analysis,
      period: this.period
    };
  }

  /**
   * Analyze EMA signals
   */
  analyzeEMA(currentPrice, ema, prices) {
    let signal = 'neutral';
    let strength = 0;
    let trend = 'sideways';
    let description = '';

    // Price vs EMA
    const priceVsEma = currentPrice - ema;
    const percentDiff = Math.abs(priceVsEma / ema) * 100;

    if (priceVsEma > 0) {
      // Price above EMA
      trend = 'bullish';

      if (percentDiff > 2) {
        signal = 'strong_above_ema';
        strength = Math.min(3, Math.floor(percentDiff / 2));
        description = `Price ${percentDiff.toFixed(1)}% above EMA - strong bullish trend`;
      } else if (percentDiff > 0.5) {
        signal = 'above_ema';
        strength = Math.min(2, Math.floor(percentDiff / 0.5));
        description = `Price ${percentDiff.toFixed(1)}% above EMA - bullish trend`;
      } else {
        signal = 'slightly_above_ema';
        strength = 1;
        description = 'Price slightly above EMA - mildly bullish';
      }
    } else {
      // Price below EMA
      trend = 'bearish';

      if (percentDiff > 2) {
        signal = 'strong_below_ema';
        strength = Math.min(3, Math.floor(percentDiff / 2));
        description = `Price ${percentDiff.toFixed(1)}% below EMA - strong bearish trend`;
      } else if (percentDiff > 0.5) {
        signal = 'below_ema';
        strength = Math.min(2, Math.floor(percentDiff / 0.5));
        description = `Price ${percentDiff.toFixed(1)}% below EMA - bearish trend`;
      } else {
        signal = 'slightly_below_ema';
        strength = 1;
        description = 'Price slightly below EMA - mildly bearish';
      }
    }

    // Check for EMA slope (trend strength)
    const emaSlope = this.calculateEMASlope(prices, this.period);
    const slopeStrength = Math.abs(emaSlope);

    if (slopeStrength > 0.5) {
      trend = emaSlope > 0 ? 'strong_bullish' : 'strong_bearish';
    }

    return {
      signal,
      strength,
      trend,
      description,
      price_vs_ema: parseFloat(priceVsEma.toFixed(4)),
      percent_diff: parseFloat(percentDiff.toFixed(2)),
      slope: parseFloat(emaSlope.toFixed(6)),
      slope_strength: parseFloat(slopeStrength.toFixed(4))
    };
  }

  /**
   * Calculate EMA slope (rate of change)
   */
  calculateEMASlope(prices, period, lookback = 5) {
    if (prices.length < period + lookback) return 0;

    const emas = [];
    for (let i = lookback; i >= 0; i--) {
      const slice = prices.slice(i, i + period);
      const ema = Calculator.calculateEMA(slice, period);
      emas.push(ema);
    }

    if (emas.length < 2) return 0;

    // Calculate slope using linear regression
    const n = emas.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = emas.reduce((sum, ema) => sum + ema, 0);
    const sumXY = emas.reduce((sum, ema, i) => sum + (ema * i), 0);
    const sumXX = emas.reduce((sum, ema, i) => sum + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    return slope || 0;
  }

  /**
   * Get EMA signal description
   */
  getSignalDescription(signal) {
    const descriptions = {
      'strong_above_ema': 'Price significantly above EMA - strong uptrend',
      'above_ema': 'Price above EMA - uptrend confirmed',
      'slightly_above_ema': 'Price slightly above EMA - mild uptrend',
      'strong_below_ema': 'Price significantly below EMA - strong downtrend',
      'below_ema': 'Price below EMA - downtrend confirmed',
      'slightly_below_ema': 'Price slightly below EMA - mild downtrend',
      'neutral': 'Price around EMA - no clear trend',
      'insufficient_data': 'Not enough data to calculate EMA'
    };

    return descriptions[signal] || 'Unknown EMA signal';
  }

  /**
   * Get EMA interpretation
   */
  getInterpretation(price, ema, trend) {
    if (ema === null) return 'Insufficient data';

    const diff = ((price - ema) / ema * 100);

    if (Math.abs(diff) < 0.1) {
      return 'Price very close to EMA - consolidation phase';
    } else if (diff > 2) {
      return `Price ${diff.toFixed(1)}% above EMA - strong uptrend`;
    } else if (diff > 0.5) {
      return `Price ${diff.toFixed(1)}% above EMA - uptrend`;
    } else if (diff < -2) {
      return `Price ${Math.abs(diff).toFixed(1)}% below EMA - strong downtrend`;
    } else if (diff < -0.5) {
      return `Price ${Math.abs(diff).toFixed(1)}% below EMA - downtrend`;
    }

    return 'Price near EMA - wait for clearer direction';
  }

  /**
   * Get recommended action based on EMA
   */
  getRecommendedAction(currentPrice, ema, trend) {
    if (ema === null) {
      return { action: 'wait', confidence: 0 };
    }

    const diff = ((currentPrice - ema) / ema) * 100;

    // Strong bullish signals
    if (diff > 3 && trend.includes('bullish')) {
      return {
        action: 'strong_buy',
        confidence: 70,
        reason: 'Price significantly above EMA with bullish trend'
      };
    }

    // Moderate bullish signals
    if (diff > 1 && trend.includes('bullish')) {
      return {
        action: 'buy',
        confidence: 55,
        reason: 'Price above EMA with bullish trend'
      };
    }

    // Strong bearish signals
    if (diff < -3 && trend.includes('bearish')) {
      return {
        action: 'strong_sell',
        confidence: 70,
        reason: 'Price significantly below EMA with bearish trend'
      };
    }

    // Moderate bearish signals
    if (diff < -1 && trend.includes('bearish')) {
      return {
        action: 'sell',
        confidence: 55,
        reason: 'Price below EMA with bearish trend'
      };
    }

    // Weak signals
    if (diff > 0.5) {
      return {
        action: 'weak_buy',
        confidence: 35,
        reason: 'Price slightly above EMA'
      };
    }

    if (diff < -0.5) {
      return {
        action: 'weak_sell',
        confidence: 35,
        reason: 'Price slightly below EMA'
      };
    }

    // No clear signal
    return {
      action: 'wait',
      confidence: 15,
      reason: 'Price too close to EMA - wait for clearer direction'
    };
  }

  /**
   * Calculate multiple EMAs
   */
  static calculateMultipleEMAs(prices, periods = [20, 50, 200]) {
    const results = {};

    periods.forEach(period => {
      const ema = Calculator.calculateEMA(prices, period);
      results[`ema_${period}`] = ema ? parseFloat(ema.toFixed(4)) : null;
    });

    return results;
  }

  /**
   * Check for EMA crossovers
   */
  static checkEMACrossovers(shortEMA, longEMA, previousShortEMA, previousLongEMA) {
    if (!shortEMA || !longEMA || !previousShortEMA || !previousLongEMA) {
      return { crossover: false, type: null };
    }

    const currentDiff = shortEMA - longEMA;
    const previousDiff = previousShortEMA - previousLongEMA;

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
   * Get EMA ribbon signals
   */
  static analyzeEMARibbon(emas) {
    // Analyze multiple EMAs for ribbon signals
    const periods = Object.keys(emas).map(key => parseInt(key.split('_')[1])).sort((a, b) => a - b);
    const values = periods.map(period => emas[`ema_${period}`]);

    if (values.some(v => v === null)) {
      return { signal: 'insufficient_data', strength: 0 };
    }

    // Check if EMAs are stacked (bullish) or inverted (bearish)
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
        description: 'EMAs in bullish alignment'
      };
    } else if (bearishStack > bullishStack) {
      return {
        signal: 'bearish_ribbon',
        strength: Math.floor((bearishStack / (periods.length - 1)) * 100),
        description: 'EMAs in bearish alignment'
      };
    }

    return {
      signal: 'neutral_ribbon',
      strength: 50,
      description: 'EMAs mixed - no clear direction'
    };
  }

  /**
   * Validate EMA parameters
   */
  validate() {
    if (!Number.isInteger(this.period) || this.period < 2 || this.period > 500) {
      throw new Error('EMA period must be an integer between 2 and 500');
    }
    return true;
  }

  /**
   * Get indicator metadata
   */
  getMetadata() {
    return {
      name: 'Exponential Moving Average',
      abbreviation: 'EMA',
      category: 'trend_following',
      description: 'Moving average that gives more weight to recent prices',
      period: this.period,
      range: 'unlimited',
      signals: ['above_ema', 'below_ema', 'crossover'],
      reliability: 'medium',
      usage: 'Used to identify trend direction and support/resistance levels'
    };
  }

  /**
   * Get optimal EMA periods for different timeframes
   */
  static getOptimalPeriods(timeframe) {
    const periods = {
      '1m': [9, 21, 55],
      '5m': [13, 34, 89],
      '15m': [20, 50, 200],
      '30m': [20, 50, 200],
      '1H': [20, 50, 200],
      '4H': [34, 89, 233],
      '1D': [20, 50, 200],
      '1W': [34, 89, 233]
    };

    return periods[timeframe] || [20, 50, 200];
  }
}

module.exports = EMA;