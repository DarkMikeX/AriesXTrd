/**
 * Crypto Data Feed Service
 * Specialized data service for cryptocurrency market data
 */

const TradingViewAPI = require('./TradingViewAPI');
const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Validator = require('../utils/Validator');

class CryptoDataFeed {
  constructor() {
    this.tradingViewAPI = new TradingViewAPI();
    this.logger = Logger.getInstance();
    this.isInitialized = false;
  }

  /**
   * Initialize the crypto data feed
   */
  async initialize(config = {}) {
    try {
      await this.tradingViewAPI.initialize(config);

      // Load crypto-specific configuration
      this.config = {
        majorCoins: [
          'BTCUSD', 'ETHUSD', 'BNBUSD', 'ADAUSD', 'SOLUSD',
          'DOTUSD', 'DOGEUSD', 'AVAXUSD', 'LTCUSD', 'LINKUSD'
        ],
        altcoins: [
          'MATICUSD', 'UNIUSD', 'SUSHIUSD', 'COMPUSD', 'MKRUSD',
          'AAVEUSD', 'CRVUSD', 'YFIUSD', 'BALUSD', 'RENUSD'
        ],
        defiTokens: [
          'UNIUSD', 'SUSHIUSD', 'COMPUSD', 'MKRUSD', 'AAVEUSD',
          'CRVUSD', 'YFIUSD', 'BALUSD', 'RENUSD', 'LRCUSD'
        ],
        marketHours: {
          timezone: 'UTC',
          session: '24/7'
        },
        exchanges: [
          'binance', 'coinbase', 'kraken', 'bitfinex', 'huobi',
          'okex', 'ftx', 'bybit', 'kucoin', 'gateio'
        ],
        ...config
      };

      this.isInitialized = true;
      this.logger.info('✅ Crypto data feed initialized');

    } catch (error) {
      this.logger.error('Failed to initialize crypto data feed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get real-time crypto price
   */
  async getCryptoPrice(symbol) {
    try {
      if (!Validator.isValidAssetSymbol(symbol, 'crypto')) {
        throw new Error(`Invalid crypto symbol: ${symbol}`);
      }

      const priceData = await this.tradingViewAPI.getRealTimePrice(symbol, 'crypto');

      // Add crypto-specific data
      const coinInfo = this.getCryptoInfo(symbol);
      const marketMetrics = await this.getCryptoMetrics(symbol);

      return {
        ...priceData,
        asset_type: 'crypto',
        info: coinInfo,
        metrics: marketMetrics,
        // Crypto-specific data
        market_cap: priceData.marketCap,
        dominance: coinInfo?.market_dominance,
        volume_24h: marketMetrics?.volume_24h,
        fear_greed_index: await this.getFearGreedIndex()
      };

    } catch (error) {
      this.logger.error('Error getting crypto price', { symbol, error: error.message });
      throw ErrorHandler.handle(error, { service: 'crypto_data_feed', symbol });
    }
  }

  /**
   * Get crypto historical data
   */
  async getCryptoHistory(symbol, timeframe = '1D', barsCount = 100) {
    try {
      if (!Validator.isValidAssetSymbol(symbol, 'crypto')) {
        throw new Error(`Invalid crypto symbol: ${symbol}`);
      }

      const historicalData = await this.tradingViewAPI.getHistoricalData(symbol, 'crypto', timeframe, barsCount);

      // Add crypto-specific analysis
      const analysis = this.analyzeCryptoData(historicalData.candles, symbol);

      return {
        ...historicalData,
        asset_type: 'crypto',
        analysis,
        indicators: this.calculateCryptoIndicators(historicalData.candles)
      };

    } catch (error) {
      this.logger.error('Error getting crypto history', { symbol, timeframe, barsCount, error: error.message });
      throw ErrorHandler.handle(error, { service: 'crypto_data_feed', symbol, timeframe });
    }
  }

  /**
   * Get multiple crypto prices
   */
  async getMultipleCryptoPrices(symbols) {
    try {
      const validSymbols = symbols.filter(symbol => Validator.isValidAssetSymbol(symbol, 'crypto'));

      if (validSymbols.length === 0) {
        throw new Error('No valid crypto symbols provided');
      }

      const promises = validSymbols.map(symbol => this.getCryptoPrice(symbol));
      const results = await Promise.allSettled(promises);

      const successful = [];
      const failed = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            symbol: validSymbols[index],
            error: result.reason.message
          });
        }
      });

      return {
        successful,
        failed,
        total_requested: symbols.length,
        total_successful: successful.length,
        total_failed: failed.length
      };

    } catch (error) {
      this.logger.error('Error getting multiple crypto prices', { symbols, error: error.message });
      throw error;
    }
  }

  /**
   * Get crypto market overview
   */
  async getCryptoMarketOverview() {
    try {
      // Get major cryptocurrencies
      const majorCoins = this.config.majorCoins.slice(0, 10);
      const coinPromises = majorCoins.map(coin => this.getCryptoPrice(coin));
      const coinResults = await Promise.allSettled(coinPromises);

      // Get market sentiment and metrics
      const successfulCoins = coinResults.filter(r => r.status === 'fulfilled').map(r => r.value);
      const marketOverview = this.calculateCryptoMarketOverview(successfulCoins);

      // Get global market metrics
      const globalMetrics = await this.getGlobalCryptoMetrics();

      return {
        timestamp: new Date(),
        major_coins: successfulCoins,
        market_overview: marketOverview,
        global_metrics: globalMetrics,
        total_coins_requested: majorCoins.length,
        total_coins_successful: successfulCoins.length
      };

    } catch (error) {
      this.logger.error('Error getting crypto market overview', { error: error.message });
      throw error;
    }
  }

  /**
   * Get crypto information
   */
  getCryptoInfo(symbol) {
    const assets = require('../../config/assets.json');
    return assets.crypto?.[symbol] || null;
  }

  /**
   * Get crypto metrics (volume, market cap, etc.)
   */
  async getCryptoMetrics(symbol) {
    // Mock data - in production, integrate with crypto APIs
    return {
      volume_24h: Math.floor(Math.random() * 1000000000),
      market_cap_rank: Math.floor(Math.random() * 100) + 1,
      circulating_supply: Math.floor(Math.random() * 100000000),
      total_supply: Math.floor(Math.random() * 100000000),
      max_supply: Math.random() > 0.5 ? Math.floor(Math.random() * 100000000) : null,
      price_change_24h: (Math.random() - 0.5) * 20,
      price_change_7d: (Math.random() - 0.5) * 30,
      price_change_30d: (Math.random() - 0.5) * 50
    };
  }

  /**
   * Get fear and greed index
   */
  async getFearGreedIndex() {
    // Mock data - in production, fetch from API
    const indices = [
      'Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'
    ];
    const value = Math.floor(Math.random() * 100);

    let label = 'Neutral';
    if (value <= 25) label = 'Extreme Fear';
    else if (value <= 45) label = 'Fear';
    else if (value <= 55) label = 'Neutral';
    else if (value <= 75) label = 'Greed';
    else label = 'Extreme Greed';

    return {
      value,
      label,
      timestamp: new Date()
    };
  }

  /**
   * Get global crypto metrics
   */
  async getGlobalCryptoMetrics() {
    // Mock data - in production, integrate with CoinGecko, CoinMarketCap, etc.
    return {
      total_market_cap: Math.floor(Math.random() * 1000000000000) + 500000000000,
      total_volume_24h: Math.floor(Math.random() * 100000000000),
      bitcoin_dominance: Math.random() * 20 + 40,
      ethereum_dominance: Math.random() * 10 + 15,
      active_cryptocurrencies: Math.floor(Math.random() * 5000) + 8000,
      market_cap_change_24h: (Math.random() - 0.5) * 10
    };
  }

  /**
   * Analyze crypto data for patterns
   */
  analyzeCryptoData(candles, symbol) {
    if (!Array.isArray(candles) || candles.length < 2) {
      return { patterns: [], trends: {}, volatility: 'unknown' };
    }

    const patterns = [];
    const trends = {
      direction: 'sideways',
      strength: 'weak',
      volatility: 'medium'
    };

    // Analyze recent price action
    const recentCandles = candles.slice(-20);
    const prices = recentCandles.map(c => c.close);
    const volumes = recentCandles.map(c => c.volume);

    // Trend analysis
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    if (Math.abs(priceChange) < 2) {
      trends.direction = 'sideways';
    } else if (priceChange > 5) {
      trends.direction = 'bullish';
    } else if (priceChange < -5) {
      trends.direction = 'bearish';
    }

    // Volatility analysis (crypto is generally more volatile)
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.abs((prices[i] - prices[i - 1]) / prices[i - 1]));
    }

    const avgVolatility = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    if (avgVolatility > 0.05) trends.volatility = 'high';
    else if (avgVolatility > 0.02) trends.volatility = 'medium';
    else trends.volatility = 'low';

    // Volume analysis
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const recentVolume = volumes[volumes.length - 1];

    if (recentVolume > avgVolume * 2) {
      patterns.push('high_volume_spike');
    }

    // Crypto-specific patterns
    if (this.isEngulfingPattern(candles.slice(-2))) {
      patterns.push('engulfing_pattern');
    }

    if (this.isBreakout(candles.slice(-10))) {
      patterns.push('breakout');
    }

    // Check for parabolic moves (common in crypto)
    if (this.isParabolicMove(recentCandles)) {
      patterns.push('parabolic_move');
      trends.volatility = 'extreme';
    }

    return {
      patterns,
      trends,
      price_change_percent: priceChange,
      volume_trend: recentVolume > avgVolume ? 'increasing' : 'decreasing',
      market_phase: this.determineMarketPhase(candles)
    };
  }

  /**
   * Calculate crypto-specific indicators
   */
  calculateCryptoIndicators(candles) {
    if (!Array.isArray(candles) || candles.length < 14) {
      return {};
    }

    // Bollinger Bands (useful for crypto volatility)
    const bb = this.calculateBollingerBands(candles);

    // RSI with crypto-specific periods
    const rsi7 = this.calculateRSI(candles.map(c => c.close), 7);
    const rsi14 = this.calculateRSI(candles.map(c => c.close), 14);

    // Volume indicators
    const volume = candles.map(c => c.volume);
    const volumeSMA = this.calculateSMA(volume, 20);

    // Crypto-specific: Social Volume Ratio (mock)
    const socialVolumeRatio = Math.random() * 2;

    return {
      bollinger_bands: bb,
      rsi_7: rsi7,
      rsi_14: rsi14,
      volume_sma: volumeSMA,
      social_volume_ratio: socialVolumeRatio,
      // On-chain metrics (would be populated from real APIs)
      active_addresses: Math.floor(Math.random() * 100000),
      transaction_count: Math.floor(Math.random() * 1000000),
      hashrate: Math.floor(Math.random() * 1000000000),
      difficulty: Math.floor(Math.random() * 1000000000000)
    };
  }

  /**
   * Calculate RSI
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;

    const gains = [];
    const losses = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    if (gains.length < period) return null;

    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(values, period) {
    if (values.length < period) return null;
    const sum = values.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(candles, period = 20, stdDev = 2) {
    if (candles.length < period) return null;

    const closes = candles.map(c => c.close);
    const sma = this.calculateSMA(closes, period);

    const variance = closes.slice(-period).reduce((acc, price) => {
      return acc + Math.pow(price - sma, 2);
    }, 0) / period;

    const std = Math.sqrt(variance);

    return {
      upper: sma + (std * stdDev),
      middle: sma,
      lower: sma - (std * stdDev),
      sma: sma,
      std_dev: std
    };
  }

  /**
   * Check for engulfing pattern
   */
  isEngulfingPattern(candles) {
    if (candles.length < 2) return false;

    const current = candles[1];
    const previous = candles[0];

    // Bullish engulfing
    const bullishEngulfing = current.close > current.open &&
                            previous.close < previous.open &&
                            current.close > previous.open &&
                            current.open < previous.close;

    // Bearish engulfing
    const bearishEngulfing = current.close < current.open &&
                            previous.close > previous.open &&
                            current.close < previous.open &&
                            current.open > previous.close;

    return bullishEngulfing || bearishEngulfing;
  }

  /**
   * Check for breakout pattern
   */
  isBreakout(candles) {
    if (candles.length < 5) return false;

    const recent = candles.slice(-5);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);

    const resistance = Math.max(...highs.slice(0, -1));
    const support = Math.min(...lows.slice(0, -1));

    const lastHigh = highs[highs.length - 1];
    const lastLow = lows[lows.length - 1];

    return lastHigh > resistance || lastLow < support;
  }

  /**
   * Check for parabolic move
   */
  isParabolicMove(candles) {
    if (candles.length < 10) return false;

    const recent = candles.slice(-10);
    const closes = recent.map(c => c.close);

    // Check for exponential growth
    let parabolicCount = 0;
    for (let i = 1; i < closes.length - 1; i++) {
      const prevChange = closes[i] - closes[i - 1];
      const nextChange = closes[i + 1] - closes[i];

      if (nextChange > prevChange * 1.5) { // 50% increase in change
        parabolicCount++;
      }
    }

    return parabolicCount >= 3; // At least 3 parabolic increases
  }

  /**
   * Determine market phase
   */
  determineMarketPhase(candles) {
    if (candles.length < 50) return 'unknown';

    const longTerm = candles.slice(-50);
    const shortTerm = candles.slice(-20);

    const longTermHigh = Math.max(...longTerm.map(c => c.high));
    const longTermLow = Math.min(...longTerm.map(c => c.low));
    const currentPrice = candles[candles.length - 1].close;

    const longTermRange = longTermHigh - longTermLow;
    const positionInRange = (currentPrice - longTermLow) / longTermRange;

    // Determine phase based on position in range and recent momentum
    if (positionInRange > 0.8) {
      return shortTerm.every(c => c.close > c.open) ? 'euphoria' : 'profit_taking';
    } else if (positionInRange < 0.2) {
      return shortTerm.every(c => c.close < c.open) ? 'capitulation' : 'accumulation';
    } else {
      const recentTrend = this.calculateSMA(shortTerm.map(c => c.close), 5);
      const olderTrend = this.calculateSMA(longTerm.slice(-20).map(c => c.close), 5);

      if (recentTrend > olderTrend * 1.05) return 'bullish_trend';
      if (recentTrend < olderTrend * 0.95) return 'bearish_trend';
      return 'consolidation';
    }
  }

  /**
   * Calculate crypto market overview
   */
  calculateCryptoMarketOverview(coins) {
    if (!Array.isArray(coins) || coins.length === 0) {
      return { sentiment: 'neutral', score: 0 };
    }

    let positiveCount = 0;
    let totalChange = 0;
    let totalVolume = 0;
    let bitcoinChange = 0;
    let altcoinCount = 0;

    coins.forEach(coin => {
      if (coin.changePercent > 0) positiveCount++;
      totalChange += coin.changePercent;
      totalVolume += coin.volume || 0;

      if (coin.symbol === 'BTCUSD') {
        bitcoinChange = coin.changePercent;
      } else {
        altcoinCount++;
      }
    });

    const positiveRatio = positiveCount / coins.length;
    const avgChange = totalChange / coins.length;

    // Altcoin Season Index (simplified)
    const altcoinPerformance = altcoinCount > 0 ?
      coins.filter(c => c.symbol !== 'BTCUSD')
           .reduce((sum, c) => sum + c.changePercent, 0) / altcoinCount : 0;

    const altcoinSeasonIndex = altcoinPerformance - bitcoinChange;

    let sentiment = 'neutral';
    let score = 50;

    if (positiveRatio > 0.6 && avgChange > 1) {
      sentiment = 'bullish';
      score = Math.min(100, 50 + (positiveRatio * 30) + (avgChange * 2));
    } else if (positiveRatio < 0.4 && avgChange < -1) {
      sentiment = 'bearish';
      score = Math.max(0, 50 - ((1 - positiveRatio) * 30) - Math.abs(avgChange));
    }

    return {
      sentiment,
      score: Math.round(score),
      positive_coins: positiveCount,
      total_coins: coins.length,
      average_change: avgChange.toFixed(2),
      total_volume: totalVolume,
      bitcoin_change: bitcoinChange.toFixed(2),
      altcoin_season_index: altcoinSeasonIndex.toFixed(2)
    };
  }

  /**
   * Search cryptocurrencies
   */
  async searchCryptos(query, limit = 10) {
    return await this.tradingViewAPI.searchSymbols(query, 'crypto', limit);
  }

  /**
   * Get DeFi protocol data (placeholder)
   */
  async getDeFiData(protocol = 'uniswap') {
    // Mock DeFi data - in production, integrate with DeFi APIs
    return {
      protocol,
      tvl: Math.floor(Math.random() * 10000000000), // Total Value Locked
      volume_24h: Math.floor(Math.random() * 1000000000),
      fees_24h: Math.floor(Math.random() * 10000000),
      users_24h: Math.floor(Math.random() * 10000),
      apy: Math.random() * 100
    };
  }

  /**
   * Get NFT market data (placeholder)
   */
  async getNFTMarketData() {
    // Mock NFT data - in production, integrate with NFT marketplaces
    return {
      total_volume_24h: Math.floor(Math.random() * 100000000),
      total_sales_24h: Math.floor(Math.random() * 10000),
      average_price: Math.floor(Math.random() * 10000),
      top_collection: 'Bored Ape Yacht Club',
      floor_price_change_24h: (Math.random() - 0.5) * 20
    };
  }

  /**
   * Get whale transactions (placeholder)
   */
  async getWhaleTransactions(symbol, minAmount = 1000000) {
    // Mock whale transaction data
    const transactions = [];
    for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
      transactions.push({
        timestamp: new Date(Date.now() - Math.random() * 86400000),
        amount: Math.floor(Math.random() * 5000000) + minAmount,
        type: Math.random() > 0.5 ? 'buy' : 'sell',
        exchange: ['binance', 'coinbase', 'kraken'][Math.floor(Math.random() * 3)],
        price: Math.random() * 50000 + 20000
      });
    }

    return {
      symbol,
      min_amount: minAmount,
      transactions: transactions.sort((a, b) => b.timestamp - a.timestamp)
    };
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      service: 'crypto_data_feed',
      tradingview_api: this.tradingViewAPI.getHealth()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.tradingViewAPI.cleanup();
    this.logger.info('✅ Crypto data feed cleaned up');
  }
}

module.exports = CryptoDataFeed;