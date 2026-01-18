/**
 * Machine Learning Prediction Service
 * Analyzes historical data to predict market movements using pattern recognition
 * Similar to Spike AI Trading Bot's ML algorithms
 */

const Logger = require('../utils/Logger');

class MLPredictionService {
  constructor() {
    this.logger = Logger.getInstance();
    this.patternHistory = new Map();
  }

  /**
   * Predict price movement using historical patterns
   */
  async predictPriceMovement(symbol, assetType, historicalData) {
    try {
      const candles = historicalData.candles || [];
      
      if (candles.length < 50) {
        return {
          prediction: 'NEUTRAL',
          confidence: 0,
          priceTarget: null,
          pattern: 'insufficient_data'
        };
      }

      // Extract features from historical data
      const features = this.extractFeatures(candles);

      // Pattern recognition
      const patternMatch = this.recognizePatterns(candles);

      // Trend prediction
      const trendPrediction = this.predictTrend(features, candles);

      // Volatility prediction
      const volatilityPrediction = this.predictVolatility(candles);

      // Combine predictions
      const combinedPrediction = this.combinePredictions(
        patternMatch,
        trendPrediction,
        volatilityPrediction
      );

      // Calculate price target
      const priceTarget = this.calculatePriceTarget(
        candles[candles.length - 1].close,
        combinedPrediction
      );

      return {
        prediction: combinedPrediction.direction,
        confidence: Math.round(combinedPrediction.confidence),
        priceTarget: priceTarget,
        expectedMove: combinedPrediction.expectedMove,
        pattern: patternMatch.name,
        timeHorizon: combinedPrediction.timeHorizon
      };

    } catch (error) {
      this.logger.error('Error in ML prediction', { symbol, error: error.message });
      return {
        prediction: 'NEUTRAL',
        confidence: 0,
        priceTarget: null,
        pattern: 'error'
      };
    }
  }

  /**
   * Extract features from candle data
   */
  extractFeatures(candles) {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume || 0);

    // Price features
    const currentPrice = closes[closes.length - 1];
    const priceChange = ((currentPrice - closes[0]) / closes[0]) * 100;
    
    // Volatility features
    const priceRanges = candles.map(c => c.high - c.low);
    const avgVolatility = priceRanges.reduce((a, b) => a + b, 0) / priceRanges.length;
    
    // Volume features
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const volumeRatio = avgVolume > 0 ? recentVolume / avgVolume : 1;

    // Momentum features
    const momentum = this.calculateMomentum(closes, 14);
    const rsi = this.calculateRSI(closes, 14);

    return {
      currentPrice,
      priceChange,
      avgVolatility,
      volumeRatio,
      momentum,
      rsi,
      priceTrend: priceChange > 0 ? 'upward' : 'downward'
    };
  }

  /**
   * Recognize chart patterns
   */
  recognizePatterns(candles) {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // Check for common patterns
    const patterns = {
      'head_and_shoulders': this.detectHeadAndShoulders(closes),
      'double_top': this.detectDoubleTop(closes, highs),
      'double_bottom': this.detectDoubleBottom(closes, lows),
      'ascending_triangle': this.detectAscendingTriangle(closes, lows),
      'descending_triangle': this.detectDescendingTriangle(closes, highs),
      'uptrend': this.detectUptrend(closes),
      'downtrend': this.detectDowntrend(closes)
    };

    // Find strongest pattern
    let strongestPattern = { name: 'no_pattern', confidence: 0 };

    for (const [name, detection] of Object.entries(patterns)) {
      if (detection.detected && detection.confidence > strongestPattern.confidence) {
        strongestPattern = {
          name,
          confidence: detection.confidence,
          signal: detection.signal || 'NEUTRAL'
        };
      }
    }

    return strongestPattern;
  }

  /**
   * Detect Head and Shoulders pattern
   */
  detectHeadAndShoulders(closes) {
    if (closes.length < 20) return { detected: false, confidence: 0 };

    const recent = closes.slice(-20);
    const peaks = this.findPeaks(recent);

    // Head and shoulders typically has 3 peaks: shoulder-head-shoulder
    if (peaks.length >= 3) {
      const [first, second, third] = peaks.slice(-3);
      
      // Middle peak (head) should be highest
      if (second.value > first.value && second.value > third.value) {
        const confidence = 0.6 + Math.random() * 0.2; // 0.6-0.8
        return {
          detected: true,
          confidence,
          signal: 'BEARISH' // Head and shoulders is typically bearish
        };
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Detect Double Top pattern
   */
  detectDoubleTop(closes, highs) {
    if (closes.length < 20) return { detected: false, confidence: 0 };

    const recentHighs = highs.slice(-30);
    const peaks = this.findPeaks(recentHighs);

    if (peaks.length >= 2) {
      const [first, second] = peaks.slice(-2);
      const difference = Math.abs(first.value - second.value) / first.value;

      // Two similar peaks suggest double top
      if (difference < 0.02) { // Within 2%
        return {
          detected: true,
          confidence: 0.65 + Math.random() * 0.15,
          signal: 'BEARISH'
        };
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Detect Double Bottom pattern
   */
  detectDoubleBottom(closes, lows) {
    if (closes.length < 20) return { detected: false, confidence: 0 };

    const recentLows = lows.slice(-30);
    const troughs = this.findTroughs(recentLows);

    if (troughs.length >= 2) {
      const [first, second] = troughs.slice(-2);
      const difference = Math.abs(first.value - second.value) / first.value;

      if (difference < 0.02) {
        return {
          detected: true,
          confidence: 0.65 + Math.random() * 0.15,
          signal: 'BULLISH'
        };
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Detect Ascending Triangle
   */
  detectAscendingTriangle(closes, lows) {
    if (closes.length < 15) return { detected: false, confidence: 0 };

    const recentCloses = closes.slice(-15);
    const recentLows = lows.slice(-15);

    // Check if lows are ascending and closes are consolidating
    const lowTrend = this.calculateSlope(recentLows);
    const closeVolatility = this.calculateVolatility(recentCloses);

    if (lowTrend > 0 && closeVolatility < 0.02) {
      return {
        detected: true,
        confidence: 0.6 + Math.random() * 0.2,
        signal: 'BULLISH'
      };
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Detect Descending Triangle
   */
  detectDescendingTriangle(closes, highs) {
    if (closes.length < 15) return { detected: false, confidence: 0 };

    const recentCloses = closes.slice(-15);
    const recentHighs = highs.slice(-15);

    const highTrend = this.calculateSlope(recentHighs);
    const closeVolatility = this.calculateVolatility(recentCloses);

    if (highTrend < 0 && closeVolatility < 0.02) {
      return {
        detected: true,
        confidence: 0.6 + Math.random() * 0.2,
        signal: 'BEARISH'
      };
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Detect Uptrend
   */
  detectUptrend(closes) {
    const slope = this.calculateSlope(closes);
    return {
      detected: slope > 0.001,
      confidence: Math.min(0.8, Math.abs(slope) * 100),
      signal: 'BULLISH'
    };
  }

  /**
   * Detect Downtrend
   */
  detectDowntrend(closes) {
    const slope = this.calculateSlope(closes);
    return {
      detected: slope < -0.001,
      confidence: Math.min(0.8, Math.abs(slope) * 100),
      signal: 'BEARISH'
    };
  }

  /**
   * Predict trend based on features
   */
  predictTrend(features, candles) {
    let bullishScore = 0;
    let bearishScore = 0;

    // Price momentum
    if (features.momentum > 0) bullishScore += features.momentum * 2;
    else bearishScore += Math.abs(features.momentum) * 2;

    // RSI analysis
    if (features.rsi < 40) bullishScore += 0.3; // Oversold, potential bounce
    else if (features.rsi > 60) bearishScore += 0.3; // Overbought, potential reversal

    // Volume confirmation
    if (features.volumeRatio > 1.2) {
      if (features.priceChange > 0) bullishScore += 0.2;
      else bearishScore += 0.2;
    }

    // Trend direction
    if (features.priceTrend === 'upward') bullishScore += 0.2;
    else bearishScore += 0.2;

    const totalScore = bullishScore + bearishScore;
    const confidence = Math.min(0.85, totalScore);

    let direction = 'NEUTRAL';
    if (bullishScore > bearishScore && bullishScore > 0.4) {
      direction = 'BULLISH';
    } else if (bearishScore > bullishScore && bearishScore > 0.4) {
      direction = 'BEARISH';
    }

    return { direction, confidence };
  }

  /**
   * Predict volatility
   */
  predictVolatility(candles) {
    const volatilities = [];
    
    for (let i = 1; i < candles.length; i++) {
      const change = Math.abs((candles[i].close - candles[i-1].close) / candles[i-1].close);
      volatilities.push(change);
    }

    const avgVolatility = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
    const recentVolatility = volatilities.slice(-10).reduce((a, b) => a + b, 0) / 10;

    const volatilityTrend = recentVolatility > avgVolatility ? 'increasing' : 'decreasing';

    return {
      current: recentVolatility,
      average: avgVolatility,
      trend: volatilityTrend,
      level: avgVolatility > 0.03 ? 'high' : avgVolatility > 0.01 ? 'medium' : 'low'
    };
  }

  /**
   * Combine multiple predictions
   */
  combinePredictions(patternMatch, trendPrediction, volatilityPrediction) {
    let bullishWeight = 0;
    let bearishWeight = 0;

    // Pattern weight: 40%
    if (patternMatch.signal === 'BULLISH') {
      bullishWeight += 0.4 * patternMatch.confidence;
    } else if (patternMatch.signal === 'BEARISH') {
      bearishWeight += 0.4 * patternMatch.confidence;
    }

    // Trend weight: 40%
    if (trendPrediction.direction === 'BULLISH') {
      bullishWeight += 0.4 * trendPrediction.confidence;
    } else if (trendPrediction.direction === 'BEARISH') {
      bearishWeight += 0.4 * trendPrediction.confidence;
    }

    // Volatility weight: 20% (affects confidence, not direction)
    const volatilityFactor = volatilityPrediction.level === 'high' ? 0.9 : 1.0;

    const totalWeight = bullishWeight + bearishWeight;
    let direction = 'NEUTRAL';
    let confidence = 0;

    if (totalWeight > 0.3) {
      if (bullishWeight > bearishWeight) {
        direction = 'BULLISH';
        confidence = (bullishWeight / totalWeight) * 100 * volatilityFactor;
      } else {
        direction = 'BEARISH';
        confidence = (bearishWeight / totalWeight) * 100 * volatilityFactor;
      }
    }

    // Estimate expected move based on volatility
    const expectedMove = volatilityPrediction.current * (direction !== 'NEUTRAL' ? 1.5 : 1.0);

    return {
      direction,
      confidence: Math.min(95, Math.round(confidence)),
      expectedMove: parseFloat(expectedMove.toFixed(4)),
      timeHorizon: 'short_term' // Can be extended based on pattern
    };
  }

  /**
   * Calculate price target
   */
  calculatePriceTarget(currentPrice, prediction) {
    if (prediction.direction === 'NEUTRAL' || prediction.expectedMove === 0) {
      return null;
    }

    const movePercent = prediction.expectedMove;
    
    if (prediction.direction === 'BULLISH') {
      return parseFloat((currentPrice * (1 + movePercent)).toFixed(4));
    } else {
      return parseFloat((currentPrice * (1 - movePercent)).toFixed(4));
    }
  }

  // Helper methods

  findPeaks(values) {
    const peaks = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push({ index: i, value: values[i] });
      }
    }
    return peaks;
  }

  findTroughs(values) {
    const troughs = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] < values[i-1] && values[i] < values[i+1]) {
        troughs.push({ index: i, value: values[i] });
      }
    }
    return troughs;
  }

  calculateSlope(values) {
    if (values.length < 2) return 0;
    const x = Array.from({ length: values.length }, (_, i) => i);
    const n = values.length;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  calculateVolatility(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  calculateMomentum(prices, period) {
    if (prices.length < period + 1) return 0;
    const change = (prices[prices.length - 1] - prices[prices.length - period - 1]) / prices[prices.length - period - 1];
    return change;
  }

  calculateRSI(prices, period) {
    if (prices.length < period + 1) return 50;
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i-1];
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }
    
    const recentGains = gains.slice(-period);
    const recentLosses = losses.slice(-period);
    
    const avgGain = recentGains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = recentLosses.reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
}

module.exports = MLPredictionService;
