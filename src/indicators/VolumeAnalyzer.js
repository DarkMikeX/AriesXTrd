/**
 * Volume Analyzer Indicator
 * Analyzes trading volume patterns and trends
 */

const Calculator = require('../utils/Calculator');

class VolumeAnalyzer {
  constructor(period = 20) {
    this.period = period;
  }

  /**
   * Analyze volume data with price information
   */
  analyze(volumes, prices, highs = null, lows = null) {
    if (!Array.isArray(volumes) || !Array.isArray(prices)) {
      return {
        volume_trend: 'insufficient_data',
        signal: 'insufficient_data',
        strength: 0
      };
    }

    if (volumes.length < this.period || prices.length < this.period) {
      return {
        volume_trend: 'insufficient_data',
        signal: 'insufficient_data',
        strength: 0
      };
    }

    // Convert price objects to numbers if needed
    const priceValues = prices.map(p => typeof p === 'object' ? p.close || p.price : p);
    const volumeValues = volumes.map(v => parseFloat(v));

    const analysis = Calculator.analyzeVolume(volumeValues, priceValues, this.period);

    if (!analysis) {
      return {
        volume_trend: 'insufficient_data',
        signal: 'insufficient_data',
        strength: 0
      };
    }

    // Enhanced analysis
    const enhancedAnalysis = this.enhanceVolumeAnalysis(analysis, volumeValues, priceValues, highs, lows);

    return {
      ...analysis,
      ...enhancedAnalysis,
      period: this.period
    };
  }

  /**
   * Enhance volume analysis with additional metrics
   */
  enhanceVolumeAnalysis(baseAnalysis, volumes, prices, highs, lows) {
    const currentVolume = volumes[volumes.length - 1];
    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - 2];

    // Volume-price relationship
    const priceDirection = currentPrice > previousPrice ? 'up' : currentPrice < previousPrice ? 'down' : 'sideways';
    const volumeStrength = currentVolume / baseAnalysis.averageVolume;

    // On-balance volume (OBV) calculation
    const obv = this.calculateOBV(volumes, prices);

    // Volume weighted average price (VWAP) if we have highs/lows
    let vwap = null;
    if (highs && lows) {
      vwap = this.calculateVWAP(highs.slice(-this.period), lows.slice(-this.period),
                               prices.slice(-this.period), volumes.slice(-this.period));
    }

    // Accumulation/Distribution Line
    const adl = this.calculateADL(highs, lows, prices, volumes);

    // Volume trend strength
    let trendStrength = 'weak';
    if (volumeStrength > 1.5) trendStrength = 'strong';
    else if (volumeStrength > 1.2) trendStrength = 'moderate';

    // Signal generation
    let signal = 'neutral';
    let strength = 0;
    let description = '';

    if (baseAnalysis.trend === 'bullish') {
      signal = 'volume_confirms_uptrend';
      strength = Math.floor(volumeStrength * 10);
      description = `Volume increasing with price uptrend (${volumeStrength.toFixed(1)}x average)`;
    } else if (baseAnalysis.trend === 'bearish') {
      signal = 'volume_confirms_downtrend';
      strength = Math.floor(volumeStrength * 10);
      description = `Volume increasing with price downtrend (${volumeStrength.toFixed(1)}x average)`;
    } else if (baseAnalysis.trend === 'low') {
      signal = 'low_volume_warning';
      strength = Math.floor((1 / volumeStrength) * 5);
      description = `Low volume (${volumeStrength.toFixed(1)}x average) - reduced conviction`;
    }

    // Check for volume climax
    const climax = this.detectVolumeClimax(volumes, this.period);
    if (climax.isClimax) {
      signal = climax.type === 'buying' ? 'volume_climax_buying' : 'volume_climax_selling';
      strength = climax.strength;
      description = `Volume climax detected - ${climax.type} pressure extreme`;
    }

    return {
      signal,
      strength,
      description,
      volume_strength: parseFloat(volumeStrength.toFixed(2)),
      price_direction: priceDirection,
      trend_strength: trendStrength,
      obv: obv ? parseFloat(obv.toFixed(2)) : null,
      vwap: vwap ? parseFloat(vwap.toFixed(4)) : null,
      adl: adl ? parseFloat(adl.toFixed(2)) : null,
      volume_climax: climax
    };
  }

  /**
   * Calculate On-Balance Volume (OBV)
   */
  calculateOBV(volumes, prices) {
    if (volumes.length !== prices.length || volumes.length < 2) return null;

    let obv = 0;

    for (let i = 1; i < volumes.length; i++) {
      if (prices[i] > prices[i - 1]) {
        obv += volumes[i];
      } else if (prices[i] < prices[i - 1]) {
        obv -= volumes[i];
      }
      // If price unchanged, OBV stays the same
    }

    return obv;
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   */
  calculateVWAP(highs, lows, closes, volumes) {
    if (!highs || !lows || !closes || !volumes ||
        highs.length !== lows.length || highs.length !== closes.length || highs.length !== volumes.length) {
      return null;
    }

    let priceVolumeSum = 0;
    let volumeSum = 0;

    for (let i = 0; i < highs.length; i++) {
      // Use typical price (H+L+C)/3
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      priceVolumeSum += typicalPrice * volumes[i];
      volumeSum += volumes[i];
    }

    return volumeSum > 0 ? priceVolumeSum / volumeSum : null;
  }

  /**
   * Calculate Accumulation/Distribution Line (ADL)
   */
  calculateADL(highs, lows, closes, volumes) {
    if (!highs || !lows || !closes || !volumes ||
        highs.length !== lows.length || highs.length !== closes.length || highs.length !== volumes.length) {
      return null;
    }

    let adl = 0;

    for (let i = 0; i < highs.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      const volume = volumes[i];

      // Money Flow Multiplier
      const mfm = ((close - low) - (high - close)) / (high - low);

      // Money Flow Volume
      const mfv = mfm * volume;

      adl += mfv;
    }

    return adl;
  }

  /**
   * Detect volume climax
   */
  detectVolumeClimax(volumes, period = 20, threshold = 2.0) {
    if (volumes.length < period) {
      return { isClimax: false, type: null, strength: 0 };
    }

    const recentVolumes = volumes.slice(-period);
    const currentVolume = recentVolumes[recentVolumes.length - 1];
    const averageVolume = recentVolumes.slice(0, -1).reduce((sum, vol) => sum + vol, 0) / (period - 1);

    const ratio = currentVolume / averageVolume;

    if (ratio >= threshold) {
      // Determine if it's buying or selling climax based on context
      // This would need price data for full analysis
      return {
        isClimax: true,
        type: 'volume_spike', // Could be 'buying' or 'selling' with more context
        strength: Math.floor(ratio * 10),
        ratio: parseFloat(ratio.toFixed(2)),
        averageVolume: parseFloat(averageVolume.toFixed(2))
      };
    }

    return { isClimax: false, type: null, strength: 0 };
  }

  /**
   * Get volume signal description
   */
  getSignalDescription(signal) {
    const descriptions = {
      'volume_confirms_uptrend': 'Volume increasing with upward price movement - bullish confirmation',
      'volume_confirms_downtrend': 'Volume increasing with downward price movement - bearish confirmation',
      'low_volume_warning': 'Low volume - reduced market participation and conviction',
      'volume_climax_buying': 'Extreme buying volume - potential exhaustion or strong bullish momentum',
      'volume_climax_selling': 'Extreme selling volume - potential exhaustion or strong bearish momentum',
      'neutral': 'Volume patterns show no clear directional bias',
      'insufficient_data': 'Not enough volume data to analyze'
    };

    return descriptions[signal] || 'Unknown volume signal';
  }

  /**
   * Get volume interpretation
   */
  getInterpretation(volumeStrength, trend) {
    if (volumeStrength === null) return 'Insufficient data';

    const ratio = parseFloat(volumeStrength);

    if (ratio > 2) {
      return `Volume is extremely high (${ratio.toFixed(1)}x average) - strong market interest`;
    } else if (ratio > 1.5) {
      return `Volume is elevated (${ratio.toFixed(1)}x average) - increased market participation`;
    } else if (ratio < 0.7) {
      return `Volume is low (${ratio.toFixed(1)}x average) - reduced market conviction`;
    }

    return `Volume is normal (${ratio.toFixed(1)}x average) - typical market participation`;
  }

  /**
   * Get recommended action based on volume analysis
   */
  getRecommendedAction(volumeStrength, trend, priceDirection) {
    if (volumeStrength === null) {
      return { action: 'wait', confidence: 0 };
    }

    const ratio = parseFloat(volumeStrength);

    // High volume with price movement - strong signal
    if (ratio > 1.8 && trend === 'bullish' && priceDirection === 'up') {
      return {
        action: 'strong_buy',
        confidence: 75,
        reason: 'High volume confirms strong uptrend'
      };
    }

    if (ratio > 1.8 && trend === 'bearish' && priceDirection === 'down') {
      return {
        action: 'strong_sell',
        confidence: 75,
        reason: 'High volume confirms strong downtrend'
      };
    }

    // Moderate volume signals
    if (ratio > 1.3 && trend === 'bullish') {
      return {
        action: 'buy',
        confidence: 55,
        reason: 'Volume supports bullish price action'
      };
    }

    if (ratio > 1.3 && trend === 'bearish') {
      return {
        action: 'sell',
        confidence: 55,
        reason: 'Volume supports bearish price action'
      };
    }

    // Low volume - caution
    if (ratio < 0.8) {
      return {
        action: 'wait',
        confidence: 25,
        reason: 'Low volume suggests weak market conviction'
      };
    }

    // Very high volume - potential climax
    if (ratio > 2.5) {
      return {
        action: 'caution',
        confidence: 30,
        reason: 'Extremely high volume - monitor for potential reversal'
      };
    }

    return {
      action: 'neutral',
      confidence: 20,
      reason: 'Volume patterns are neutral'
    };
  }

  /**
   * Analyze volume profile
   */
  analyzeVolumeProfile(volumes, priceLevels, period = 50) {
    // Simplified volume profile analysis
    const profile = {};

    if (volumes.length !== priceLevels.length) return profile;

    // Group volumes by price levels
    for (let i = 0; i < Math.min(volumes.length, period); i++) {
      const price = Math.floor(priceLevels[i] * 100) / 100; // Round to 2 decimals
      if (!profile[price]) profile[price] = 0;
      profile[price] += volumes[i];
    }

    // Find high volume levels
    const sortedLevels = Object.entries(profile)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    return {
      high_volume_levels: sortedLevels.map(([price, volume]) => ({
        price: parseFloat(price),
        volume: parseFloat(volume)
      })),
      total_period_volume: volumes.slice(-period).reduce((sum, vol) => sum + vol, 0)
    };
  }

  /**
   * Validate Volume Analyzer parameters
   */
  validate() {
    if (!Number.isInteger(this.period) || this.period < 2 || this.period > 200) {
      throw new Error('Volume analysis period must be an integer between 2 and 200');
    }
    return true;
  }

  /**
   * Get indicator metadata
   */
  getMetadata() {
    return {
      name: 'Volume Analyzer',
      abbreviation: 'VOL',
      category: 'volume',
      description: 'Analyzes trading volume patterns and their relationship with price',
      period: this.period,
      range: { min: 0, max: 'unlimited' },
      signals: ['volume_confirms_uptrend', 'volume_confirms_downtrend', 'low_volume_warning'],
      reliability: 'medium',
      usage: 'Used to confirm price movements and identify market participation levels'
    };
  }

  /**
   * Get volume analysis for multiple timeframes
   */
  static analyzeMultiTimeframeVolume(volumes, prices, timeframes = [10, 20, 50]) {
    const results = {};

    timeframes.forEach(period => {
      const analysis = Calculator.analyzeVolume(volumes, prices, period);
      if (analysis) {
        results[`period_${period}`] = {
          trend: analysis.trend,
          strength: analysis.strength,
          volume_ratio: analysis.volumeRatio
        };
      }
    });

    return results;
  }

  /**
   * Detect volume divergences
   */
  static detectVolumeDivergence(volumes, prices, period = 20) {
    // Simplified volume-price divergence detection
    if (volumes.length < period * 2 || prices.length < period * 2) {
      return { divergence: false, type: null };
    }

    const recentVolumes = volumes.slice(-period);
    const olderVolumes = volumes.slice(-period * 2, -period);
    const recentPrices = prices.slice(-period);
    const olderPrices = prices.slice(-period * 2, -period);

    const recentVolumeAvg = recentVolumes.reduce((sum, vol) => sum + vol, 0) / period;
    const olderVolumeAvg = olderVolumes.reduce((sum, vol) => sum + vol, 0) / period;
    const recentPriceAvg = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    const olderPriceAvg = olderPrices.reduce((sum, price) => sum + price, 0) / period;

    const volumeTrend = recentVolumeAvg > olderVolumeAvg ? 'increasing' : 'decreasing';
    const priceTrend = recentPriceAvg > olderPriceAvg ? 'increasing' : 'decreasing';

    if (volumeTrend !== priceTrend) {
      return {
        divergence: true,
        type: volumeTrend === 'increasing' && priceTrend === 'decreasing' ? 'bullish' : 'bearish',
        strength: Math.abs(recentVolumeAvg - olderVolumeAvg) / olderVolumeAvg
      };
    }

    return { divergence: false, type: null };
  }
}

module.exports = VolumeAnalyzer;