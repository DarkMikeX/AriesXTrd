/**
 * Bollinger Bands Indicator
 * Volatility bands placed above and below a moving average
 */

const Calculator = require('../utils/Calculator');

class BollingerBands {
  constructor(period = 20, standardDeviations = 2) {
    this.period = period;
    this.standardDeviations = standardDeviations;
  }

  /**
   * Calculate Bollinger Bands for price data
   */
  calculate(prices) {
    if (!Array.isArray(prices) || prices.length < this.period) {
      return {
        upper: null,
        middle: null,
        lower: null,
        bandwidth: null,
        percentB: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    // Convert price objects to numbers if needed
    const priceValues = prices.map(p => typeof p === 'object' ? p.close || p.price : p);

    const bb = Calculator.calculateBollingerBands(priceValues, this.period, this.standardDeviations);

    if (!bb) {
      return {
        upper: null,
        middle: null,
        lower: null,
        bandwidth: null,
        percentB: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    // Calculate additional metrics
    const currentPrice = priceValues[priceValues.length - 1];
    const percentB = this.calculatePercentB(currentPrice, bb.lower, bb.upper);
    const bandwidth = this.calculateBandwidth(bb.lower, bb.upper, bb.middle);

    // Analyze signals
    const analysis = this.analyzeBollingerBands(currentPrice, bb, percentB, bandwidth);

    return {
      ...bb,
      bandwidth,
      percentB,
      ...analysis,
      period: this.period,
      standardDeviations: this.standardDeviations
    };
  }

  /**
   * Calculate %B (position within bands)
   */
  calculatePercentB(price, lower, upper) {
    if (upper === lower) return 0.5; // Avoid division by zero
    return (price - lower) / (upper - lower);
  }

  /**
   * Calculate bandwidth
   */
  calculateBandwidth(lower, upper, middle) {
    if (middle === 0) return 0; // Avoid division by zero
    return (upper - lower) / middle;
  }

  /**
   * Analyze Bollinger Bands signals
   */
  analyzeBollingerBands(currentPrice, bb, percentB, bandwidth) {
    const { upper, middle, lower } = bb;

    let signal = 'neutral';
    let strength = 0;
    let description = '';

    // Price position relative to bands
    if (currentPrice <= lower) {
      // Price at or below lower band
      signal = 'lower_band_touch';
      strength = Math.max(1, Math.floor((lower - currentPrice) / lower * 100));

      if (strength > 3) {
        signal = 'lower_band_break';
        description = 'Price broke below lower Bollinger Band - extreme oversold condition';
      } else {
        description = 'Price touching lower Bollinger Band - potential buying opportunity';
      }
    } else if (currentPrice >= upper) {
      // Price at or above upper band
      signal = 'upper_band_touch';
      strength = Math.max(1, Math.floor((currentPrice - upper) / upper * 100));

      if (strength > 3) {
        signal = 'upper_band_break';
        description = 'Price broke above upper Bollinger Band - extreme overbought condition';
      } else {
        description = 'Price touching upper Bollinger Band - potential selling opportunity';
      }
    } else if (percentB < 0.2) {
      // Price near lower band
      signal = 'near_lower_band';
      strength = Math.floor((0.2 - percentB) * 5);
      description = 'Price near lower Bollinger Band - moderately oversold';
    } else if (percentB > 0.8) {
      // Price near upper band
      signal = 'near_upper_band';
      strength = Math.floor((percentB - 0.8) * 5);
      description = 'Price near upper Bollinger Band - moderately overbought';
    } else {
      // Price within normal range
      signal = 'within_bands';
      strength = 0;
      description = 'Price within normal Bollinger Band range';
    }

    // Analyze bandwidth (volatility)
    const volatility = this.interpretBandwidth(bandwidth);

    return {
      signal,
      strength,
      description,
      volatility,
      percentB: parseFloat(percentB.toFixed(4)),
      bandwidth: parseFloat(bandwidth.toFixed(4))
    };
  }

  /**
   * Interpret bandwidth for volatility
   */
  interpretBandwidth(bandwidth) {
    if (bandwidth > 0.1) return 'high_volatility';
    if (bandwidth > 0.05) return 'moderate_volatility';
    if (bandwidth > 0.02) return 'low_volatility';
    return 'very_low_volatility';
  }

  /**
   * Get Bollinger Bands signal description
   */
  getSignalDescription(signal) {
    const descriptions = {
      'lower_band_touch': 'Price touching lower Bollinger Band - potential reversal up',
      'lower_band_break': 'Price broke below lower Bollinger Band - extreme condition',
      'upper_band_touch': 'Price touching upper Bollinger Band - potential reversal down',
      'upper_band_break': 'Price broke above upper Bollinger Band - extreme condition',
      'near_lower_band': 'Price near lower band - oversold condition',
      'near_upper_band': 'Price near upper band - overbought condition',
      'within_bands': 'Price within normal range - no clear signal',
      'insufficient_data': 'Not enough data to calculate Bollinger Bands'
    };

    return descriptions[signal] || 'Unknown Bollinger Bands signal';
  }

  /**
   * Get Bollinger Bands interpretation
   */
  getInterpretation(percentB, bandwidth) {
    if (percentB === null) return 'Insufficient data';

    let position = '';
    if (percentB < 0.1) position = 'at extreme lower end';
    else if (percentB < 0.2) position = 'near lower band';
    else if (percentB > 0.9) position = 'at extreme upper end';
    else if (percentB > 0.8) position = 'near upper band';
    else if (percentB > 0.45 && percentB < 0.55) position = 'near middle band';
    else position = 'within normal range';

    let volatility = '';
    if (bandwidth > 0.1) volatility = ' (high volatility)';
    else if (bandwidth > 0.05) volatility = ' (moderate volatility)';
    else if (bandwidth > 0.02) volatility = ' (low volatility)';
    else volatility = ' (very low volatility)';

    return `Price is ${position}${volatility}`;
  }

  /**
   * Get recommended action based on Bollinger Bands
   */
  getRecommendedAction(currentPrice, bb, percentB) {
    if (!bb || percentB === null) {
      return { action: 'wait', confidence: 0 };
    }

    const { lower, upper } = bb;

    // Extreme oversold - price broke below lower band
    if (currentPrice < lower && percentB < 0) {
      return {
        action: 'strong_buy',
        confidence: 80,
        reason: 'Price broke below lower Bollinger Band - extreme oversold condition'
      };
    }

    // Oversold - price at lower band
    if (currentPrice <= lower && percentB <= 0.05) {
      return {
        action: 'buy',
        confidence: 65,
        reason: 'Price at lower Bollinger Band - oversold condition'
      };
    }

    // Near lower band
    if (percentB <= 0.2) {
      return {
        action: 'weak_buy',
        confidence: 45,
        reason: 'Price near lower Bollinger Band'
      };
    }

    // Extreme overbought - price broke above upper band
    if (currentPrice > upper && percentB > 1) {
      return {
        action: 'strong_sell',
        confidence: 80,
        reason: 'Price broke above upper Bollinger Band - extreme overbought condition'
      };
    }

    // Overbought - price at upper band
    if (currentPrice >= upper && percentB >= 0.95) {
      return {
        action: 'sell',
        confidence: 65,
        reason: 'Price at upper Bollinger Band - overbought condition'
      };
    }

    // Near upper band
    if (percentB >= 0.8) {
      return {
        action: 'weak_sell',
        confidence: 45,
        reason: 'Price near upper Bollinger Band'
      };
    }

    // Price within normal range
    return {
      action: 'wait',
      confidence: 20,
      reason: 'Price within normal Bollinger Band range'
    };
  }

  /**
   * Detect Bollinger Band squeeze
   */
  detectSqueeze(bandwidth, threshold = 0.02) {
    if (bandwidth < threshold) {
      return {
        squeeze: true,
        strength: Math.floor((threshold - bandwidth) / threshold * 100),
        description: 'Bollinger Band squeeze detected - volatility contraction'
      };
    }

    return {
      squeeze: false,
      strength: 0,
      description: 'No Bollinger Band squeeze'
    };
  }

  /**
   * Get band expansion signals
   */
  getBandExpansion(currentBandwidth, previousBandwidth) {
    if (!previousBandwidth) return { expansion: 'unknown' };

    const ratio = currentBandwidth / previousBandwidth;

    if (ratio > 1.5) {
      return {
        expansion: 'rapid',
        strength: Math.floor((ratio - 1) * 100),
        description: 'Bands expanding rapidly - increasing volatility'
      };
    } else if (ratio > 1.2) {
      return {
        expansion: 'moderate',
        strength: Math.floor((ratio - 1) * 100),
        description: 'Bands expanding moderately'
      };
    } else if (ratio < 0.8) {
      return {
        expansion: 'contracting',
        strength: Math.floor((1 - ratio) * 100),
        description: 'Bands contracting - decreasing volatility'
      };
    }

    return {
      expansion: 'stable',
      strength: 0,
      description: 'Band width stable'
    };
  }

  /**
   * Get Bollinger Band levels
   */
  getLevels() {
    return {
      extreme_oversold: 0,
      oversold: 0.05,
      near_lower: 0.2,
      middle_lower: 0.45,
      middle: 0.5,
      middle_upper: 0.55,
      near_upper: 0.8,
      overbought: 0.95,
      extreme_overbought: 1.0,
      squeeze_threshold: 0.02
    };
  }

  /**
   * Validate Bollinger Bands parameters
   */
  validate() {
    if (!Number.isInteger(this.period) || this.period < 2 || this.period > 200) {
      throw new Error('Period must be an integer between 2 and 200');
    }
    if (this.standardDeviations < 1 || this.standardDeviations > 5) {
      throw new Error('Standard deviations must be between 1 and 5');
    }
    return true;
  }

  /**
   * Get indicator metadata
   */
  getMetadata() {
    return {
      name: 'Bollinger Bands',
      abbreviation: 'BB',
      category: 'volatility',
      description: 'Volatility bands placed above and below a moving average',
      period: this.period,
      standardDeviations: this.standardDeviations,
      components: ['Upper Band', 'Middle Band (SMA)', 'Lower Band', '%B', 'Bandwidth'],
      signals: ['lower_band_touch', 'upper_band_touch', 'near_lower_band', 'near_upper_band'],
      reliability: 'medium',
      usage: 'Used to identify overbought/oversold conditions and volatility'
    };
  }

  /**
   * Get optimal settings for different assets
   */
  static getOptimalSettings(assetType, volatility = 'medium') {
    const settings = {
      stock: {
        low_volatility: { period: 25, stdDev: 1.5 },
        medium_volatility: { period: 20, stdDev: 2 },
        high_volatility: { period: 15, stdDev: 2.5 }
      },
      forex: {
        low_volatility: { period: 20, stdDev: 1.8 },
        medium_volatility: { period: 20, stdDev: 2 },
        high_volatility: { period: 18, stdDev: 2.2 }
      },
      crypto: {
        low_volatility: { period: 15, stdDev: 2.5 },
        medium_volatility: { period: 12, stdDev: 3 },
        high_volatility: { period: 10, stdDev: 3.5 }
      }
    };

    return settings[assetType]?.[volatility] || { period: 20, stdDev: 2 };
  }
}

module.exports = BollingerBands;