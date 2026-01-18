/**
 * Moving Average Convergence Divergence (MACD) Indicator
 * Shows relationship between two moving averages of a security's price
 */

const Calculator = require('../utils/Calculator');

class MACD {
  constructor(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.signalPeriod = signalPeriod;
  }

  /**
   * Calculate MACD for an array of prices
   */
  calculate(prices) {
    if (!Array.isArray(prices) || prices.length < this.slowPeriod) {
      return {
        macd: null,
        signal: null,
        histogram: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    const macdData = Calculator.calculateMACD(prices, this.fastPeriod, this.slowPeriod, this.signalPeriod);

    if (!macdData) {
      return {
        macd: null,
        signal: null,
        histogram: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    // Analyze MACD signals
    const analysis = this.analyzeMACD(macdData);

    return {
      ...macdData,
      ...analysis,
      periods: {
        fast: this.fastPeriod,
        slow: this.slowPeriod,
        signal: this.signalPeriod
      }
    };
  }

  /**
   * Analyze MACD data for signals
   */
  analyzeMACD(macdData) {
    const { macd, signal, histogram } = macdData;

    if (macd === null || signal === null) {
      return {
        signal: 'insufficient_data',
        strength: 0,
        description: 'Not enough data to calculate MACD'
      };
    }

    let macdSignal = 'neutral';
    let strength = 0;
    let description = '';

    // MACD line vs Signal line crossovers
    if (macd > signal && histogram > 0) {
      // Bullish crossover
      macdSignal = 'bullish_crossover';
      strength = Math.min(3, Math.floor(Math.abs(histogram) * 10));
      description = 'MACD line crossed above signal line - bullish momentum';
    } else if (macd < signal && histogram < 0) {
      // Bearish crossover
      macdSignal = 'bearish_crossover';
      strength = Math.min(3, Math.floor(Math.abs(histogram) * 10));
      description = 'MACD line crossed below signal line - bearish momentum';
    } else if (Math.abs(histogram) < 0.0001) {
      // Lines are very close
      macdSignal = 'convergence';
      strength = 1;
      description = 'MACD and signal lines are converging';
    } else {
      // No clear crossover
      if (histogram > 0.001) {
        macdSignal = 'bullish_momentum';
        strength = Math.min(2, Math.floor(histogram * 100));
        description = 'MACD shows bullish momentum';
      } else if (histogram < -0.001) {
        macdSignal = 'bearish_momentum';
        strength = Math.min(2, Math.floor(Math.abs(histogram) * 100));
        description = 'MACD shows bearish momentum';
      }
    }

    // Check for divergence with histogram
    const histogramTrend = histogram > 0 ? 'positive' : 'negative';
    const macdTrend = macd > 0 ? 'positive' : 'negative';

    return {
      signal: macdSignal,
      strength,
      description,
      histogram_trend: histogramTrend,
      macd_trend: macdTrend,
      zero_line_cross: macd > 0 ? 'above' : 'below'
    };
  }

  /**
   * Get MACD signal description
   */
  getSignalDescription(signal) {
    const descriptions = {
      'bullish_crossover': 'MACD line crossed above signal line - strong bullish signal',
      'bearish_crossover': 'MACD line crossed below signal line - strong bearish signal',
      'bullish_momentum': 'MACD shows bullish momentum above signal line',
      'bearish_momentum': 'MACD shows bearish momentum below signal line',
      'convergence': 'MACD and signal lines are converging - potential reversal',
      'neutral': 'MACD shows no clear directional bias',
      'insufficient_data': 'Not enough data to calculate MACD'
    };

    return descriptions[signal] || 'Unknown MACD signal';
  }

  /**
   * Get MACD interpretation
   */
  getInterpretation(macd, signal, histogram) {
    if (macd === null) return 'Insufficient data';

    const macdValue = parseFloat(macd);
    const signalValue = signal ? parseFloat(signal) : 0;
    const histValue = parseFloat(histogram);

    if (macdValue > signalValue && histValue > 0) {
      return 'Strong bullish momentum - MACD above signal line with positive histogram';
    } else if (macdValue < signalValue && histValue < 0) {
      return 'Strong bearish momentum - MACD below signal line with negative histogram';
    } else if (Math.abs(histValue) < 0.001) {
      return 'MACD and signal lines are close - potential trend change';
    } else if (macdValue > 0 && signalValue > 0) {
      return 'Bullish trend - both MACD and signal above zero line';
    } else if (macdValue < 0 && signalValue < 0) {
      return 'Bearish trend - both MACD and signal below zero line';
    }

    return 'Mixed signals - monitor for clearer direction';
  }

  /**
   * Calculate MACD divergence
   */
  calculateDivergence(priceData, macdData) {
    // This would compare price movements with MACD movements
    // Simplified implementation
    return {
      type: 'no_divergence',
      strength: 'none',
      description: 'MACD divergence analysis not implemented in basic version'
    };
  }

  /**
   * Get recommended action based on MACD
   */
  getRecommendedAction(macd, signal, histogram) {
    if (macd === null || signal === null) {
      return { action: 'wait', confidence: 0 };
    }

    const macdVal = parseFloat(macd);
    const signalVal = parseFloat(signal);
    const histVal = parseFloat(histogram);

    // Strong bullish crossover
    if (macdVal > signalVal && histVal > 0.002) {
      return {
        action: 'buy',
        confidence: 75,
        reason: 'MACD bullish crossover with strong histogram'
      };
    }

    // Strong bearish crossover
    if (macdVal < signalVal && histVal < -0.002) {
      return {
        action: 'sell',
        confidence: 75,
        reason: 'MACD bearish crossover with strong histogram'
      };
    }

    // Moderate signals
    if (macdVal > signalVal && histVal > 0) {
      return {
        action: 'weak_buy',
        confidence: 55,
        reason: 'MACD shows mild bullish momentum'
      };
    }

    if (macdVal < signalVal && histVal < 0) {
      return {
        action: 'weak_sell',
        confidence: 55,
        reason: 'MACD shows mild bearish momentum'
      };
    }

    // Zero line cross
    if ((macdVal > 0 && signalVal < 0) || (macdVal < 0 && signalVal > 0)) {
      return {
        action: 'wait',
        confidence: 40,
        reason: 'MACD zero line cross - monitor for confirmation'
      };
    }

    return { action: 'wait', confidence: 20 };
  }

  /**
   * Get MACD levels and thresholds
   */
  getLevels() {
    return {
      strong_bullish: { histogram: 0.002 },
      strong_bearish: { histogram: -0.002 },
      moderate_bullish: { histogram: 0.001 },
      moderate_bearish: { histogram: -0.001 },
      zero_line: 0,
      convergence_threshold: 0.0001
    };
  }

  /**
   * Validate MACD parameters
   */
  validate() {
    if (!Number.isInteger(this.fastPeriod) || this.fastPeriod < 2) {
      throw new Error('Fast period must be an integer >= 2');
    }
    if (!Number.isInteger(this.slowPeriod) || this.slowPeriod <= this.fastPeriod) {
      throw new Error('Slow period must be an integer > fast period');
    }
    if (!Number.isInteger(this.signalPeriod) || this.signalPeriod < 2) {
      throw new Error('Signal period must be an integer >= 2');
    }
    return true;
  }

  /**
   * Get indicator metadata
   */
  getMetadata() {
    return {
      name: 'Moving Average Convergence Divergence',
      abbreviation: 'MACD',
      category: 'trend_following',
      description: 'Shows relationship between fast and slow exponential moving averages',
      periods: {
        fast: this.fastPeriod,
        slow: this.slowPeriod,
        signal: this.signalPeriod
      },
      components: ['MACD line', 'Signal line', 'Histogram'],
      signals: ['bullish_crossover', 'bearish_crossover', 'bullish_momentum', 'bearish_momentum'],
      reliability: 'high',
      usage: 'Used to identify trend changes and momentum shifts'
    };
  }

  /**
   * Get optimal MACD settings for different timeframes
   */
  static getOptimalSettings(timeframe) {
    const settings = {
      '1m': { fast: 8, slow: 17, signal: 9 },
      '5m': { fast: 12, slow: 26, signal: 9 },
      '15m': { fast: 12, slow: 26, signal: 9 },
      '30m': { fast: 12, slow: 26, signal: 9 },
      '1H': { fast: 12, slow: 26, signal: 9 },
      '4H': { fast: 19, slow: 39, signal: 9 },
      '1D': { fast: 12, slow: 26, signal: 9 },
      '1W': { fast: 12, slow: 26, signal: 9 }
    };

    return settings[timeframe] || { fast: 12, slow: 26, signal: 9 };
  }
}

module.exports = MACD;