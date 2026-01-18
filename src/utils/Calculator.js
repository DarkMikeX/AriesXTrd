/**
 * Calculator Utility
 * Mathematical calculations for trading indicators and analysis
 */

class Calculator {
  /**
   * Calculate Simple Moving Average (SMA)
   */
  static calculateSMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
      return null;
    }

    const values = prices.slice(-period);
    const sum = values.reduce((acc, price) => acc + parseFloat(price), 0);
    return sum / period;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   */
  static calculateEMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
      return null;
    }

    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
      ema = (parseFloat(prices[i]) - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate Weighted Moving Average (WMA)
   */
  static calculateWMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
      return null;
    }

    const values = prices.slice(-period);
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < period; i++) {
      const weight = i + 1;
      numerator += parseFloat(values[i]) * weight;
      denominator += weight;
    }

    return numerator / denominator;
  }

  /**
   * Calculate Relative Strength Index (RSI)
   */
  static calculateRSI(prices, period = 14) {
    if (!Array.isArray(prices) || prices.length < period + 1) {
      return null;
    }

    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = parseFloat(prices[i]) - parseFloat(prices[i - 1]);
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    if (gains.length < period) return null;

    // Calculate initial averages
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

    // Calculate RSI using Wilder's smoothing
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  static calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (!Array.isArray(prices) || prices.length < slowPeriod) {
      return null;
    }

    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);

    if (!fastEMA || !slowEMA) return null;

    const macd = fastEMA - slowEMA;
    const signal = this.calculateEMA(
      prices.slice(-(prices.length - slowPeriod + 1)).map((_, i) => {
        const slice = prices.slice(i, i + slowPeriod);
        return this.calculateEMA(slice, fastPeriod) - this.calculateEMA(slice, slowPeriod);
      }).filter(val => val !== null),
      signalPeriod
    );

    const histogram = macd - (signal || 0);

    return {
      macd: parseFloat(macd.toFixed(6)),
      signal: signal ? parseFloat(signal.toFixed(6)) : null,
      histogram: parseFloat(histogram.toFixed(6))
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  static calculateBollingerBands(prices, period = 20, standardDeviations = 2) {
    if (!Array.isArray(prices) || prices.length < period) {
      return null;
    }

    const sma = this.calculateSMA(prices, period);
    const values = prices.slice(-period);

    // Calculate standard deviation
    const variance = values.reduce((acc, price) => {
      return acc + Math.pow(parseFloat(price) - sma, 2);
    }, 0) / period;

    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + (stdDev * standardDeviations),
      middle: sma,
      lower: sma - (stdDev * standardDeviations),
      sma: sma,
      stdDev: stdDev
    };
  }

  /**
   * Calculate Stochastic Oscillator
   */
  static calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) {
      return null;
    }

    if (highs.length < kPeriod || lows.length < kPeriod || closes.length < kPeriod) {
      return null;
    }

    // Calculate %K
    const kValues = [];
    for (let i = kPeriod - 1; i < closes.length; i++) {
      const highSlice = highs.slice(i - kPeriod + 1, i + 1);
      const lowSlice = lows.slice(i - kPeriod + 1, i + 1);

      const highestHigh = Math.max(...highSlice.map(h => parseFloat(h)));
      const lowestLow = Math.min(...lowSlice.map(l => parseFloat(l)));
      const currentClose = parseFloat(closes[i]);

      const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.push(k);
    }

    // Calculate %D (SMA of %K)
    const d = this.calculateSMA(kValues, dPeriod);

    return {
      k: kValues[kValues.length - 1] || null,
      d: d,
      kValues: kValues,
      dValues: kValues.length >= dPeriod ? [d] : []
    };
  }

  /**
   * Calculate Average True Range (ATR)
   */
  static calculateATR(highs, lows, closes, period = 14) {
    if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) {
      return null;
    }

    if (highs.length < period || lows.length < period || closes.length < period) {
      return null;
    }

    const trueRanges = [];

    for (let i = 1; i < highs.length; i++) {
      const high = parseFloat(highs[i]);
      const low = parseFloat(lows[i]);
      const prevClose = parseFloat(closes[i - 1]);

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    if (trueRanges.length < period) return null;

    // Calculate ATR using Wilder's smoothing
    let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
    }

    return atr;
  }

  /**
   * Calculate Volume indicators
   */
  static analyzeVolume(volumes, prices, period = 20) {
    if (!Array.isArray(volumes) || !Array.isArray(prices) || volumes.length < period) {
      return null;
    }

    const avgVolume = this.calculateSMA(volumes, period);
    const currentVolume = parseFloat(volumes[volumes.length - 1]);
    const currentPrice = parseFloat(prices[prices.length - 1]);
    const prevPrice = parseFloat(prices[prices.length - 2]);

    const volumeRatio = currentVolume / avgVolume;
    const priceDirection = currentPrice > prevPrice ? 'up' : 'down';

    let trend = 'neutral';
    if (volumeRatio > 1.2 && priceDirection === 'up') trend = 'bullish';
    else if (volumeRatio > 1.2 && priceDirection === 'down') trend = 'bearish';
    else if (volumeRatio < 0.8) trend = 'low';

    return {
      currentVolume: currentVolume,
      averageVolume: avgVolume,
      volumeRatio: volumeRatio,
      trend: trend,
      strength: volumeRatio > 1.5 ? 'high' : volumeRatio > 1.2 ? 'medium' : 'low'
    };
  }

  /**
   * Calculate Fibonacci retracement levels
   */
  static calculateFibonacciLevels(high, low) {
    const diff = high - low;
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

    return levels.reduce((acc, level) => {
      acc[level] = low + (diff * level);
      return acc;
    }, {});
  }

  /**
   * Calculate support and resistance levels
   */
  static calculateSupportResistance(prices, period = 20) {
    if (!Array.isArray(prices) || prices.length < period) {
      return null;
    }

    const recentPrices = prices.slice(-period);
    const sorted = [...recentPrices].sort((a, b) => parseFloat(a) - parseFloat(b));

    return {
      support: sorted[Math.floor(sorted.length * 0.25)], // 25th percentile
      resistance: sorted[Math.floor(sorted.length * 0.75)] // 75th percentile
    };
  }

  /**
   * Calculate correlation between two price series
   */
  static calculateCorrelation(prices1, prices2) {
    if (!Array.isArray(prices1) || !Array.isArray(prices2) ||
        prices1.length !== prices2.length || prices1.length < 2) {
      return null;
    }

    const n = prices1.length;
    const sum1 = prices1.reduce((sum, val) => sum + parseFloat(val), 0);
    const sum2 = prices2.reduce((sum, val) => sum + parseFloat(val), 0);
    const sum1Sq = prices1.reduce((sum, val) => sum + Math.pow(parseFloat(val), 2), 0);
    const sum2Sq = prices2.reduce((sum, val) => sum + Math.pow(parseFloat(val), 2), 0);
    const sumProd = prices1.reduce((sum, val, i) => sum + (parseFloat(val) * parseFloat(prices2[i])), 0);

    const numerator = (n * sumProd) - (sum1 * sum2);
    const denominator = Math.sqrt(((n * sum1Sq) - Math.pow(sum1, 2)) * ((n * sum2Sq) - Math.pow(sum2, 2)));

    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  static calculateVolatility(prices, period = 20) {
    if (!Array.isArray(prices) || prices.length < period + 1) {
      return null;
    }

    // Calculate returns
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const return_pct = (parseFloat(prices[i]) - parseFloat(prices[i - 1])) / parseFloat(prices[i - 1]);
      returns.push(return_pct);
    }

    const recentReturns = returns.slice(-period);

    // Calculate standard deviation
    const mean = recentReturns.reduce((sum, ret) => sum + ret, 0) / recentReturns.length;
    const variance = recentReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / recentReturns.length;

    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  /**
   * Calculate Sharpe ratio
   */
  static calculateSharpeRatio(returns, riskFreeRate = 0.02) {
    if (!Array.isArray(returns) || returns.length === 0) {
      return null;
    }

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const volatility = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    );

    if (volatility === 0) return 0;

    return (avgReturn - riskFreeRate) / volatility;
  }

  /**
   * Calculate maximum drawdown
   */
  static calculateMaxDrawdown(prices) {
    if (!Array.isArray(prices) || prices.length < 2) {
      return null;
    }

    let maxDrawdown = 0;
    let peak = parseFloat(prices[0]);
    let currentDrawdown = 0;

    for (let i = 1; i < prices.length; i++) {
      const price = parseFloat(prices[i]);

      if (price > peak) {
        peak = price;
        currentDrawdown = 0;
      } else {
        currentDrawdown = (peak - price) / peak;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }
    }

    return {
      maxDrawdown: maxDrawdown,
      maxDrawdownPercent: maxDrawdown * 100,
      peak: peak
    };
  }

  /**
   * Round number to specified decimal places
   */
  static round(num, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(parseFloat(num) * factor) / factor;
  }

  /**
   * Calculate percentage change
   */
  static percentageChange(current, previous) {
    if (!previous || previous === 0) return 0;
    return ((parseFloat(current) - parseFloat(previous)) / Math.abs(parseFloat(previous))) * 100;
  }

  /**
   * Calculate compound annual growth rate (CAGR)
   */
  static calculateCAGR(initialValue, finalValue, years) {
    if (years <= 0 || initialValue <= 0) return 0;
    return (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
  }

  /**
   * Calculate position size based on risk management
   */
  static calculatePositionSize(accountBalance, riskPercent, stopLossPips, pipValue = 0.0001) {
    const riskAmount = accountBalance * (riskPercent / 100);
    const positionSize = riskAmount / (stopLossPips * pipValue);
    return Math.floor(positionSize * 100) / 100; // Round to 2 decimal places
  }
}

module.exports = Calculator;