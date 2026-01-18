/**
 * Relative Strength Index (RSI) Indicator
 * Measures the speed and change of price movements
 */

const Calculator = require('../utils/Calculator');

class RSI {
  constructor(period = 14) {
    this.period = period;
  }

  /**
   * Calculate RSI for an array of prices
   */
  calculate(prices) {
    if (!Array.isArray(prices) || prices.length < this.period + 1) {
      return {
        rsi: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    const rsi = Calculator.calculateRSI(prices, this.period);

    if (rsi === null) {
      return {
        rsi: null,
        signal: 'insufficient_data',
        strength: 0
      };
    }

    // Determine signal based on RSI levels
    let signal = 'neutral';
    let strength = 0;

    if (rsi <= 30) {
      signal = 'oversold';
      strength = Math.max(1, Math.floor((30 - rsi) / 5) + 1); // 1-6 points for oversold
    } else if (rsi >= 70) {
      signal = 'overbought';
      strength = Math.max(1, Math.floor((rsi - 70) / 5) + 1); // 1-6 points for overbought
    } else if (rsi > 50) {
      signal = 'bullish';
      strength = Math.floor((rsi - 50) / 5); // 0-4 points for bullish
    } else if (rsi < 50) {
      signal = 'bearish';
      strength = Math.floor((50 - rsi) / 5); // 0-4 points for bearish
    }

    return {
      rsi: parseFloat(rsi.toFixed(2)),
      signal,
      strength,
      period: this.period,
      levels: {
        oversold: 30,
        overbought: 70,
        neutral_low: 40,
        neutral_high: 60
      }
    };
  }

  /**
   * Get RSI signal description
   */
  getSignalDescription(signal) {
    const descriptions = {
      'oversold': 'Price is oversold, potential buying opportunity',
      'overbought': 'Price is overbought, potential selling opportunity',
      'bullish': 'RSI indicates bullish momentum',
      'bearish': 'RSI indicates bearish momentum',
      'neutral': 'RSI is in neutral territory',
      'insufficient_data': 'Not enough data to calculate RSI'
    };

    return descriptions[signal] || 'Unknown RSI signal';
  }

  /**
   * Get RSI interpretation
   */
  getInterpretation(rsi) {
    if (rsi === null) return 'Insufficient data';

    if (rsi >= 80) return 'Extremely overbought - strong reversal potential';
    if (rsi >= 70) return 'Overbought - potential reversal';
    if (rsi >= 60) return 'Bullish - strong upward momentum';
    if (rsi >= 55) return 'Moderately bullish';
    if (rsi >= 45) return 'Neutral - no clear direction';
    if (rsi >= 40) return 'Moderately bearish';
    if (rsi >= 30) return 'Bearish - strong downward momentum';
    if (rsi >= 20) return 'Oversold - potential reversal';
    return 'Extremely oversold - strong reversal potential';
  }

  /**
   * Calculate RSI divergence (price vs RSI)
   */
  calculateDivergence(prices, rsiValues) {
    if (!Array.isArray(prices) || !Array.isArray(rsiValues) ||
        prices.length !== rsiValues.length || prices.length < 4) {
      return null;
    }

    // Simple divergence detection
    const recentPrices = prices.slice(-4);
    const recentRSI = rsiValues.slice(-4);

    const priceTrend = recentPrices[3] > recentPrices[0] ? 'up' : 'down';
    const rsiTrend = recentRSI[3] > recentRSI[0] ? 'up' : 'down';

    if (priceTrend !== rsiTrend) {
      return {
        type: priceTrend === 'up' ? 'bearish_divergence' : 'bullish_divergence',
        strength: 'moderate',
        description: priceTrend === 'up'
          ? 'Price making higher highs, RSI making lower highs - bearish divergence'
          : 'Price making lower lows, RSI making higher lows - bullish divergence'
      };
    }

    return {
      type: 'no_divergence',
      strength: 'none',
      description: 'No divergence detected'
    };
  }

  /**
   * Get recommended action based on RSI
   */
  getRecommendedAction(rsi, currentTrend = 'neutral') {
    if (rsi === null) return { action: 'wait', confidence: 0 };

    // Oversold conditions
    if (rsi <= 25) {
      return {
        action: 'strong_buy',
        confidence: 85,
        reason: 'Extremely oversold - high probability reversal'
      };
    }

    if (rsi <= 30) {
      return {
        action: 'buy',
        confidence: 70,
        reason: 'Oversold - potential buying opportunity'
      };
    }

    // Overbought conditions
    if (rsi >= 75) {
      return {
        action: 'strong_sell',
        confidence: 85,
        reason: 'Extremely overbought - high probability reversal'
      };
    }

    if (rsi >= 70) {
      return {
        action: 'sell',
        confidence: 70,
        reason: 'Overbought - potential selling opportunity'
      };
    }

    // Neutral zone
    if (rsi >= 45 && rsi <= 55) {
      return {
        action: 'wait',
        confidence: 30,
        reason: 'RSI in neutral zone - wait for clearer signal'
      };
    }

    // Mild signals
    if (rsi > 55 && rsi < 70) {
      return {
        action: 'weak_buy',
        confidence: 45,
        reason: 'Mild bullish momentum'
      };
    }

    if (rsi > 30 && rsi < 45) {
      return {
        action: 'weak_sell',
        confidence: 45,
        reason: 'Mild bearish momentum'
      };
    }

    return { action: 'wait', confidence: 0 };
  }

  /**
   * Validate RSI parameters
   */
  validate() {
    if (!Number.isInteger(this.period) || this.period < 2 || this.period > 100) {
      throw new Error('RSI period must be an integer between 2 and 100');
    }
    return true;
  }

  /**
   * Get indicator metadata
   */
  getMetadata() {
    return {
      name: 'Relative Strength Index',
      abbreviation: 'RSI',
      category: 'momentum',
      description: 'Measures the speed and change of price movements on a scale of 0 to 100',
      period: this.period,
      range: { min: 0, max: 100 },
      signals: ['oversold', 'overbought', 'bullish', 'bearish', 'neutral'],
      reliability: 'high',
      usage: 'Used to identify overbought and oversold conditions'
    };
  }
}

module.exports = RSI;