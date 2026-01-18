/**
 * Stochastic Oscillator Indicator
 * Momentum indicator comparing closing price to price range over period
 */

const Calculator = require('../utils/Calculator');

class Stochastic {
  constructor(kPeriod = 14, dPeriod = 3) {
    this.kPeriod = kPeriod;
    this.dPeriod = dPeriod;
  }

  /**
   * Calculate Stochastic for high, low, close prices
   */
  calculate(highs, lows, closes) {
    if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) {
      return {
        k: null,
        d: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    if (highs.length < this.kPeriod || lows.length < this.kPeriod || closes.length < this.kPeriod) {
      return {
        k: null,
        d: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    const stoch = Calculator.calculateStochastic(highs, lows, closes, this.kPeriod, this.dPeriod);

    if (!stoch) {
      return {
        k: null,
        d: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    // Analyze Stochastic signals
    const analysis = this.analyzeStochastic(stoch.k, stoch.d);

    return {
      ...stoch,
      ...analysis,
      periods: {
        k: this.kPeriod,
        d: this.dPeriod
      }
    };
  }

  /**
   * Analyze Stochastic signals
   */
  analyzeStochastic(k, d) {
    if (k === null || d === null) {
      return {
        signal: 'insufficient_data',
        strength: 0,
        description: 'Not enough data to calculate Stochastic'
      };
    }

    let signal = 'neutral';
    let strength = 0;
    let description = '';

    // Overbought/Oversold levels
    if (k <= 20) {
      signal = 'oversold';
      strength = Math.max(1, Math.floor((20 - k) / 5) + 1); // 1-5 points for oversold
      description = `Stochastic K at ${k.toFixed(1)} - oversold condition`;
    } else if (k >= 80) {
      signal = 'overbought';
      strength = Math.max(1, Math.floor((k - 80) / 5) + 1); // 1-5 points for overbought
      description = `Stochastic K at ${k.toFixed(1)} - overbought condition`;
    } else if (k > 50 && k < 80) {
      signal = 'bullish';
      strength = Math.floor((k - 50) / 10); // 0-3 points for bullish
      description = `Stochastic K at ${k.toFixed(1)} - bullish momentum`;
    } else if (k > 20 && k < 50) {
      signal = 'bearish';
      strength = Math.floor((50 - k) / 10); // 0-3 points for bearish
      description = `Stochastic K at ${k.toFixed(1)} - bearish momentum`;
    }

    // Check for K%D crossover signals
    if (k && d) {
      const kValues = [k]; // Simplified - in practice would have historical values
      const dValues = [d];

      if (kValues.length >= 2 && dValues.length >= 2) {
        const prevK = kValues[kValues.length - 2];
        const prevD = dValues[dValues.length - 2];

        if (k > d && prevK <= prevD) {
          signal = 'bullish_crossover';
          strength = Math.min(3, Math.floor(Math.abs(k - d) / 5));
          description = 'Stochastic K crossed above D - bullish signal';
        } else if (k < d && prevK >= prevD) {
          signal = 'bearish_crossover';
          strength = Math.min(3, Math.floor(Math.abs(k - d) / 5));
          description = 'Stochastic K crossed below D - bearish signal';
        }
      }

      // Check for divergence
      const divergence = this.checkStochasticDivergence(k, d);
      if (divergence.type !== 'no_divergence') {
        signal = divergence.type;
        strength = divergence.strength;
        description = divergence.description;
      }
    }

    return {
      signal,
      strength,
      description,
      k_level: this.getStochasticLevel(k),
      d_level: this.getStochasticLevel(d),
      convergence: k && d ? Math.abs(k - d) < 5 : false
    };
  }

  /**
   * Get Stochastic level description
   */
  getStochasticLevel(value) {
    if (value === null) return 'unknown';

    if (value >= 80) return 'overbought';
    if (value <= 20) return 'oversold';
    if (value > 50) return 'bullish';
    if (value < 50) return 'bearish';
    return 'neutral';
  }

  /**
   * Check for Stochastic divergence
   */
  checkStochasticDivergence(k, d) {
    // This would require price data to compare with Stochastic
    // Simplified implementation
    return {
      type: 'no_divergence',
      strength: 0,
      description: 'No divergence detected'
    };
  }

  /**
   * Get Stochastic signal description
   */
  getSignalDescription(signal) {
    const descriptions = {
      'oversold': 'Stochastic oscillator indicates oversold condition - potential reversal up',
      'overbought': 'Stochastic oscillator indicates overbought condition - potential reversal down',
      'bullish_crossover': 'Stochastic %K crossed above %D - bullish momentum signal',
      'bearish_crossover': 'Stochastic %K crossed below %D - bearish momentum signal',
      'bullish': 'Stochastic shows bullish momentum in neutral zone',
      'bearish': 'Stochastic shows bearish momentum in neutral zone',
      'bullish_divergence': 'Bullish divergence between price and Stochastic',
      'bearish_divergence': 'Bearish divergence between price and Stochastic',
      'neutral': 'Stochastic oscillator shows no clear directional bias',
      'insufficient_data': 'Not enough data to calculate Stochastic oscillator'
    };

    return descriptions[signal] || 'Unknown Stochastic signal';
  }

  /**
   * Get Stochastic interpretation
   */
  getInterpretation(k, d) {
    if (k === null) return 'Insufficient data';

    const kVal = parseFloat(k);
    const dVal = d ? parseFloat(d) : null;

    if (kVal >= 80) {
      return '%K at ' + kVal.toFixed(1) + ' - extremely overbought';
    } else if (kVal >= 70) {
      return '%K at ' + kVal.toFixed(1) + ' - overbought';
    } else if (kVal <= 20) {
      return '%K at ' + kVal.toFixed(1) + ' - extremely oversold';
    } else if (kVal <= 30) {
      return '%K at ' + kVal.toFixed(1) + ' - oversold';
    } else if (dVal) {
      const spread = Math.abs(kVal - dVal);
      if (spread < 2) {
        return '%K and %D close together - potential crossover';
      } else if (kVal > dVal) {
        return '%K above %D - bullish momentum';
      } else {
        return '%K below %D - bearish momentum';
      }
    }

    return '%K at ' + kVal.toFixed(1) + ' - neutral zone';
  }

  /**
   * Get recommended action based on Stochastic
   */
  getRecommendedAction(k, d) {
    if (k === null) {
      return { action: 'wait', confidence: 0 };
    }

    const kVal = parseFloat(k);
    const dVal = d ? parseFloat(d) : kVal;

    // Strong oversold signals
    if (kVal <= 20) {
      return {
        action: 'strong_buy',
        confidence: 75,
        reason: 'Stochastic extremely oversold - high probability reversal'
      };
    }

    // Moderate oversold signals
    if (kVal <= 30) {
      return {
        action: 'buy',
        confidence: 60,
        reason: 'Stochastic oversold - potential buying opportunity'
      };
    }

    // Strong overbought signals
    if (kVal >= 80) {
      return {
        action: 'strong_sell',
        confidence: 75,
        reason: 'Stochastic extremely overbought - high probability reversal'
      };
    }

    // Moderate overbought signals
    if (kVal >= 70) {
      return {
        action: 'sell',
        confidence: 60,
        reason: 'Stochastic overbought - potential selling opportunity'
      };
    }

    // Crossover signals
    if (d !== null && k > d && Math.abs(k - d) > 5) {
      return {
        action: 'buy',
        confidence: 55,
        reason: 'Stochastic bullish crossover'
      };
    }

    if (d !== null && k < d && Math.abs(k - d) > 5) {
      return {
        action: 'sell',
        confidence: 55,
        reason: 'Stochastic bearish crossover'
      };
    }

    // Weak signals
    if (kVal > 55) {
      return {
        action: 'weak_buy',
        confidence: 35,
        reason: 'Stochastic mildly bullish'
      };
    }

    if (kVal < 45) {
      return {
        action: 'weak_sell',
        confidence: 35,
        reason: 'Stochastic mildly bearish'
      };
    }

    return {
      action: 'wait',
      confidence: 15,
      reason: 'Stochastic in neutral zone - wait for clearer signal'
    };
  }

  /**
   * Get Stochastic levels and thresholds
   */
  getLevels() {
    return {
      extreme_oversold: 20,
      oversold: 30,
      neutral_low: 40,
      neutral_high: 60,
      overbought: 70,
      extreme_overbought: 80,
      crossover_threshold: 5,
      convergence_threshold: 2
    };
  }

  /**
   * Calculate Fast Stochastic (%K only)
   */
  static calculateFastStochastic(highs, lows, closes, period = 14) {
    if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) {
      return null;
    }

    if (highs.length < period || lows.length < period || closes.length < period) {
      return null;
    }

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    if (highestHigh === lowestLow) return 50; // Avoid division by zero

    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    return parseFloat(k.toFixed(2));
  }

  /**
   * Calculate Slow Stochastic (%D as SMA of %K)
   */
  static calculateSlowStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    // Calculate %K values for the last dPeriod + kPeriod - 1 periods
    const kValues = [];

    for (let i = kPeriod - 1; i < Math.min(highs.length, kPeriod + dPeriod - 1); i++) {
      const sliceHighs = highs.slice(i - kPeriod + 1, i + 1);
      const sliceLows = lows.slice(i - kPeriod + 1, i + 1);
      const sliceCloses = closes.slice(i - kPeriod + 1, i + 1);

      const highestHigh = Math.max(...sliceHighs);
      const lowestLow = Math.min(...sliceLows);
      const currentClose = sliceCloses[sliceCloses.length - 1];

      if (highestHigh !== lowestLow) {
        const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
        kValues.push(k);
      }
    }

    if (kValues.length < dPeriod) return { k: null, d: null };

    // Calculate %D as SMA of %K
    const d = Calculator.calculateSMA(kValues, dPeriod);

    return {
      k: kValues[kValues.length - 1] || null,
      d: d,
      kValues: kValues,
      dValues: kValues.length >= dPeriod ? [d] : []
    };
  }

  /**
   * Validate Stochastic parameters
   */
  validate() {
    if (!Number.isInteger(this.kPeriod) || this.kPeriod < 2 || this.kPeriod > 100) {
      throw new Error('%K period must be an integer between 2 and 100');
    }
    if (!Number.isInteger(this.dPeriod) || this.dPeriod < 2 || this.dPeriod > 50) {
      throw new Error('%D period must be an integer between 2 and 50');
    }
    return true;
  }

  /**
   * Get indicator metadata
   */
  getMetadata() {
    return {
      name: 'Stochastic Oscillator',
      abbreviation: 'STOCH',
      category: 'momentum',
      description: 'Momentum indicator comparing closing price to price range over a period',
      periods: {
        k: this.kPeriod,
        d: this.dPeriod
      },
      components: ['%K (Fast)', '%D (Slow/Signal)'],
      range: { min: 0, max: 100 },
      signals: ['oversold', 'overbought', 'bullish_crossover', 'bearish_crossover'],
      reliability: 'medium',
      usage: 'Used to identify overbought/oversold conditions and momentum shifts'
    };
  }

  /**
   * Get optimal Stochastic settings for different assets
   */
  static getOptimalSettings(assetType, timeframe = '1D') {
    const settings = {
      stock: {
        '1D': { k: 14, d: 3 },
        '1H': { k: 14, d: 3 },
        '15m': { k: 9, d: 3 }
      },
      forex: {
        '1D': { k: 14, d: 3 },
        '4H': { k: 14, d: 3 },
        '1H': { k: 9, d: 3 }
      },
      crypto: {
        '1D': { k: 14, d: 3 },
        '4H': { k: 12, d: 3 },
        '1H': { k: 9, d: 3 }
      }
    };

    return settings[assetType]?.[timeframe] || { k: 14, d: 3 };
  }
}

module.exports = Stochastic;