/**
 * Forex Data Feed Service
 * Specialized data service for forex market data
 */

const TradingViewAPI = require('./TradingViewAPI');
const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Validator = require('../utils/Validator');

class ForexDataFeed {
  constructor() {
    this.tradingViewAPI = new TradingViewAPI();
    this.logger = Logger.getInstance();
    this.isInitialized = false;
  }

  /**
   * Initialize the forex data feed
   */
  async initialize(config = {}) {
    try {
      await this.tradingViewAPI.initialize(config);

      // Load forex-specific configuration
      this.config = {
        majorPairs: [
          'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD',
          'USDCAD', 'NZDUSD', 'EURJPY', 'GBPJPY', 'EURGBP'
        ],
        minorPairs: [
          'EURGBP', 'EURCHF', 'EURCAD', 'EURAUD', 'GBPEUR',
          'GBPCHF', 'GBPCAD', 'GBPAUD', 'USDSEK', 'USDNOK'
        ],
        exoticPairs: [
          'USDTRY', 'USDMXN', 'USDZAR', 'USDRUB', 'USDHKD'
        ],
        marketHours: {
          timezone: 'UTC',
          session: '24/7',
          asianSession: { start: '00:00', end: '09:00' },
          europeanSession: { start: '07:00', end: '16:00' },
          usSession: { start: '13:30', end: '22:00' }
        },
        ...config
      };

      this.isInitialized = true;
      this.logger.info('✅ Forex data feed initialized');

    } catch (error) {
      this.logger.error('Failed to initialize forex data feed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get real-time forex price
   */
  async getForexPrice(pair) {
    try {
      if (!Validator.isValidAssetSymbol(pair, 'forex')) {
        throw new Error(`Invalid forex pair: ${pair}`);
      }

      const priceData = await this.tradingViewAPI.getRealTimePrice(pair, 'forex');

      // Add forex-specific data
      const pairInfo = this.getForexPairInfo(pair);
      const marketSession = this.getCurrentMarketSession();

      return {
        ...priceData,
        asset_type: 'forex',
        info: pairInfo,
        market_session: marketSession,
        // Forex-specific metrics
        spread: pairInfo?.spread || 0.0001,
        volatility: this.calculatePairVolatility(pair),
        correlation: await this.getPairCorrelation(pair)
      };

    } catch (error) {
      this.logger.error('Error getting forex price', { pair, error: error.message });
      throw ErrorHandler.handle(error, { service: 'forex_data_feed', pair });
    }
  }

  /**
   * Get forex historical data
   */
  async getForexHistory(pair, timeframe = '1H', barsCount = 100) {
    try {
      if (!Validator.isValidAssetSymbol(pair, 'forex')) {
        throw new Error(`Invalid forex pair: ${pair}`);
      }

      // Normalize timeframe for short Forex timeframes before calling API
      let normalizedTimeframe = timeframe;
      if (this.tradingViewAPI.normalizeTimeframe) {
        normalizedTimeframe = this.tradingViewAPI.normalizeTimeframe(timeframe);
      }

      const historicalData = await this.tradingViewAPI.getHistoricalData(pair, 'forex', normalizedTimeframe, barsCount);

      // Add forex-specific analysis
      const analysis = this.analyzeForexData(historicalData.candles, pair);

      return {
        ...historicalData,
        asset_type: 'forex',
        analysis,
        indicators: this.calculateForexIndicators(historicalData.candles)
      };

    } catch (error) {
      this.logger.error('Error getting forex history', { pair, timeframe, barsCount, error: error.message });
      throw ErrorHandler.handle(error, { service: 'forex_data_feed', pair, timeframe });
    }
  }

  /**
   * Get multiple forex prices
   */
  async getMultipleForexPrices(pairs) {
    try {
      const validPairs = pairs.filter(pair => Validator.isValidAssetSymbol(pair, 'forex'));

      if (validPairs.length === 0) {
        throw new Error('No valid forex pairs provided');
      }

      const promises = validPairs.map(pair => this.getForexPrice(pair));
      const results = await Promise.allSettled(promises);

      const successful = [];
      const failed = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            pair: validPairs[index],
            error: result.reason.message
          });
        }
      });

      return {
        successful,
        failed,
        total_requested: pairs.length,
        total_successful: successful.length,
        total_failed: failed.length
      };

    } catch (error) {
      this.logger.error('Error getting multiple forex prices', { pairs, error: error.message });
      throw error;
    }
  }

  /**
   * Get forex market overview
   */
  async getForexMarketOverview() {
    try {
      // Get major pairs
      const majorPairs = this.config.majorPairs.slice(0, 8);
      const pairPromises = majorPairs.map(pair => this.getForexPrice(pair));
      const pairResults = await Promise.allSettled(pairPromises);

      // Get market sentiment
      const successfulPairs = pairResults.filter(r => r.status === 'fulfilled').map(r => r.value);
      const marketSentiment = this.calculateForexMarketSentiment(successfulPairs);

      // Get current market session
      const currentSession = this.getCurrentMarketSession();

      return {
        timestamp: new Date(),
        major_pairs: successfulPairs,
        market_sentiment: marketSentiment,
        current_session: currentSession,
        session_volatility: this.getSessionVolatility(currentSession.session),
        total_pairs_requested: majorPairs.length,
        total_pairs_successful: successfulPairs.length
      };

    } catch (error) {
      this.logger.error('Error getting forex market overview', { error: error.message });
      throw error;
    }
  }

  /**
   * Get forex pair information
   */
  getForexPairInfo(pair) {
    const assets = require('../../config/assets.json');
    return assets.forex?.[pair] || null;
  }

  /**
   * Get current market session
   */
  getCurrentMarketSession() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const currentMinutes = utcHour * 60 + utcMinute;

    const sessions = {
      asian: { start: 0, end: 9 * 60, name: 'Asian' },
      european: { start: 7 * 60, end: 16 * 60, name: 'European' },
      us: { start: 13.5 * 60, end: 22 * 60, name: 'US' },
      overlap: { start: 13.5 * 60, end: 16 * 60, name: 'Overlap' }
    };

    // Check for overlap first (most volatile)
    if (currentMinutes >= sessions.overlap.start && currentMinutes <= sessions.overlap.end) {
      return {
        session: 'overlap',
        name: sessions.overlap.name,
        volatility: 'high',
        active: true
      };
    }

    // Check other sessions
    for (const [key, session] of Object.entries(sessions)) {
      if (key !== 'overlap' && currentMinutes >= session.start && currentMinutes <= session.end) {
        return {
          session: key,
          name: session.name,
          volatility: key === 'us' ? 'high' : key === 'european' ? 'medium' : 'low',
          active: true
        };
      }
    }

    return {
      session: 'off-hours',
      name: 'Off Hours',
      volatility: 'very_low',
      active: false
    };
  }

  /**
   * Get session volatility
   */
  getSessionVolatility(session) {
    const volatilities = {
      asian: 'low',
      european: 'medium',
      us: 'high',
      overlap: 'very_high',
      'off-hours': 'very_low'
    };

    return volatilities[session] || 'medium';
  }

  /**
   * Calculate pair volatility
   */
  calculatePairVolatility(pair) {
    // Mock volatility calculation - in production, calculate from historical data
    const baseVolatilities = {
      'EURUSD': 0.0008,
      'GBPUSD': 0.0012,
      'USDJPY': 0.012,
      'USDCHF': 0.0010,
      'AUDUSD': 0.0011,
      'USDCAD': 0.0009,
      'NZDUSD': 0.0010
    };

    return baseVolatilities[pair] || 0.0010;
  }

  /**
   * Get pair correlation (simplified)
   */
  async getPairCorrelation(pair) {
    // Mock correlation data - in production, calculate from historical data
    const correlations = {
      'EURUSD': { 'GBPUSD': 0.85, 'USDCHF': -0.75, 'USDJPY': -0.60 },
      'GBPUSD': { 'EURUSD': 0.85, 'USDJPY': -0.70, 'AUDUSD': 0.60 },
      'USDJPY': { 'EURUSD': -0.60, 'GBPUSD': -0.70, 'AUDUSD': -0.50 }
    };

    return correlations[pair] || {};
  }

  /**
   * Analyze forex data for patterns
   */
  analyzeForexData(candles, pair) {
    if (!Array.isArray(candles) || candles.length < 2) {
      return { patterns: [], trends: {}, pivots: [] };
    }

    const patterns = [];
    const trends = {
      direction: 'sideways',
      strength: 'weak',
      momentum: 'neutral'
    };

    // Analyze recent price action
    const recentCandles = candles.slice(-20);
    const prices = recentCandles.map(c => c.close);

    // Trend analysis using moving averages
    const sma20 = this.calculateSMA(prices, 10);
    const sma50 = this.calculateSMA(prices, 20);

    if (sma20 > sma50 * 1.001) {
      trends.direction = 'bullish';
    } else if (sma20 < sma50 * 0.999) {
      trends.direction = 'bearish';
    }

    // Momentum analysis
    const recentPrices = prices.slice(-5);
    const priceChanges = [];
    for (let i = 1; i < recentPrices.length; i++) {
      priceChanges.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1]);
    }

    const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    if (Math.abs(avgChange) > 0.0005) { // 0.05% threshold
      trends.momentum = avgChange > 0 ? 'bullish' : 'bearish';
      trends.strength = Math.abs(avgChange) > 0.001 ? 'strong' : 'moderate';
    }

    // Forex-specific patterns
    const lastCandle = candles[candles.length - 1];
    if (this.isInsideBar(candles.slice(-2))) {
      patterns.push('inside_bar');
    }

    if (this.isPinBar(lastCandle)) {
      patterns.push('pin_bar');
    }

    // Support and resistance levels
    const pivots = this.calculatePivotPoints(candles.slice(-50));

    return {
      patterns,
      trends,
      pivots,
      session: this.getCurrentMarketSession(),
      correlation: {} // Would be populated with real correlation data
    };
  }

  /**
   * Calculate forex-specific indicators
   */
  calculateForexIndicators(candles) {
    if (!Array.isArray(candles) || candles.length < 14) {
      return {};
    }

    // Average True Range (good for forex volatility)
    const atr = this.calculateATR(candles);

    // Commodity Channel Index (CCI) - useful for forex
    const cci = this.calculateCCI(candles);

    // Williams %R
    const williamsR = this.calculateWilliamsR(candles);

    return {
      atr,
      cci,
      williams_r: williamsR,
      // Forex-specific spreads and costs
      spread_cost: 0.0001, // 1 pip spread
      swap_cost: 0.0002 // Daily swap cost
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate Average True Range
   */
  calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return null;

    const trueRanges = [];
    for (let i = 1; i < Math.min(candles.length, period + 1); i++) {
      const candle = candles[i];
      const prevCandle = candles[i - 1];

      const tr1 = candle.high - candle.low;
      const tr2 = Math.abs(candle.high - prevCandle.close);
      const tr3 = Math.abs(candle.low - prevCandle.close);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }

  /**
   * Calculate Commodity Channel Index
   */
  calculateCCI(candles, period = 20) {
    if (candles.length < period) return null;

    const recentCandles = candles.slice(-period);
    const typicalPrices = recentCandles.map(c => (c.high + c.low + c.close) / 3);
    const sma = this.calculateSMA(typicalPrices, period);
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

    if (meanDeviation === 0) return 0;

    const currentTP = (recentCandles[recentCandles.length - 1].high +
                      recentCandles[recentCandles.length - 1].low +
                      recentCandles[recentCandles.length - 1].close) / 3;

    return (currentTP - sma) / (0.015 * meanDeviation);
  }

  /**
   * Calculate Williams %R
   */
  calculateWilliamsR(candles, period = 14) {
    if (candles.length < period) return null;

    const recentCandles = candles.slice(-period);
    const highest = Math.max(...recentCandles.map(c => c.high));
    const lowest = Math.min(...recentCandles.map(c => c.low));
    const currentClose = recentCandles[recentCandles.length - 1].close;

    if (highest === lowest) return -50;

    return -100 * (highest - currentClose) / (highest - lowest);
  }

  /**
   * Check if candles form an inside bar pattern
   */
  isInsideBar(candles) {
    if (candles.length < 2) return false;

    const current = candles[1];
    const previous = candles[0];

    return current.high <= previous.high && current.low >= previous.low;
  }

  /**
   * Check if candle is a pin bar
   */
  isPinBar(candle) {
    const { open, high, low, close } = candle;
    const body = Math.abs(close - open);
    const totalRange = high - low;
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;

    // Pin bar: long shadow (75% of total range), small body
    const longShadow = Math.max(upperShadow, lowerShadow);
    return longShadow / totalRange > 0.75 && body / totalRange < 0.3;
  }

  /**
   * Calculate pivot points
   */
  calculatePivotPoints(candles) {
    if (candles.length < 1) return [];

    const recent = candles[candles.length - 1];
    const high = recent.high;
    const low = recent.low;
    const close = recent.close;

    const pivot = (high + low + close) / 3;
    const r1 = 2 * pivot - low;
    const r2 = pivot + (high - low);
    const s1 = 2 * pivot - high;
    const s2 = pivot - (high - low);

    return [
      { level: 'R2', value: r2, type: 'resistance' },
      { level: 'R1', value: r1, type: 'resistance' },
      { level: 'P', value: pivot, type: 'pivot' },
      { level: 'S1', value: s1, type: 'support' },
      { level: 'S2', value: s2, type: 'support' }
    ];
  }

  /**
   * Calculate forex market sentiment
   */
  calculateForexMarketSentiment(pairs) {
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return { sentiment: 'neutral', score: 0 };
    }

    let positiveCount = 0;
    let totalChange = 0;
    let usdStrength = 0;

    pairs.forEach(pair => {
      if (pair.changePercent > 0) positiveCount++;
      totalChange += pair.changePercent;

      // Calculate USD strength
      if (pair.symbol.includes('USD')) {
        if (pair.symbol.startsWith('USD')) {
          // USD as base (USDXXX) - inverse logic
          usdStrength += pair.changePercent * -1;
        } else {
          // USD as quote (XXXUSD) - direct logic
          usdStrength += pair.changePercent;
        }
      }
    });

    const positiveRatio = positiveCount / pairs.length;
    const avgChange = totalChange / pairs.length;
    const usdStrengthScore = usdStrength / Math.max(pairs.filter(p => p.symbol.includes('USD')).length, 1);

    let sentiment = 'neutral';
    let score = 50;

    if (positiveRatio > 0.6 && avgChange > 0.05) {
      sentiment = 'bullish';
      score = Math.min(100, 50 + (positiveRatio * 50));
    } else if (positiveRatio < 0.4 && avgChange < -0.05) {
      sentiment = 'bearish';
      score = Math.max(0, 50 - ((1 - positiveRatio) * 50));
    }

    return {
      sentiment,
      score: Math.round(score),
      usd_strength: usdStrengthScore.toFixed(4),
      positive_pairs: positiveCount,
      total_pairs: pairs.length,
      average_change: avgChange.toFixed(4)
    };
  }

  /**
   * Search forex pairs
   */
  async searchForexPairs(query, limit = 10) {
    return await this.tradingViewAPI.searchSymbols(query, 'forex', limit);
  }

  /**
   * Get forex economic calendar (placeholder)
   */
  async getEconomicCalendar(fromDate, toDate) {
    // This would integrate with economic calendar APIs
    // For now, return mock data
    return {
      events: [
        {
          date: '2024-01-15',
          time: '08:30',
          currency: 'USD',
          event: 'CPI',
          impact: 'high',
          forecast: '0.3%',
          previous: '0.2%'
        }
      ],
      period: { from: fromDate, to: toDate }
    };
  }

  /**
   * Get currency strength meter
   */
  async getCurrencyStrength() {
    try {
      const currencies = ['EUR', 'GBP', 'USD', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'];
      const strength = {};

      // Simplified calculation - in production, use proper formulas
      currencies.forEach(currency => {
        strength[currency] = Math.random() * 100; // 0-100 strength score
      });

      return {
        timestamp: new Date(),
        currencies: strength,
        strongest: Object.keys(strength).reduce((a, b) => strength[a] > strength[b] ? a : b),
        weakest: Object.keys(strength).reduce((a, b) => strength[a] < strength[b] ? a : b)
      };

    } catch (error) {
      this.logger.error('Error calculating currency strength', { error: error.message });
      throw error;
    }
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      service: 'forex_data_feed',
      tradingview_api: this.tradingViewAPI.getHealth()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.tradingViewAPI.cleanup();
    this.logger.info('✅ Forex data feed cleaned up');
  }
}

module.exports = ForexDataFeed;