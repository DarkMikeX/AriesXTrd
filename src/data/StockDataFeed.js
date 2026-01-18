/**
 * Stock Data Feed Service
 * Specialized data service for stock market data
 */

const TradingViewAPI = require('./TradingViewAPI');
const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Validator = require('../utils/Validator');

class StockDataFeed {
  constructor() {
    this.tradingViewAPI = new TradingViewAPI();
    this.logger = Logger.getInstance();
    this.isInitialized = false;
  }

  /**
   * Initialize the stock data feed
   */
  async initialize(config = {}) {
    try {
      await this.tradingViewAPI.initialize(config);

      // Load stock-specific configuration
      this.config = {
        popularStocks: [
          'AAPL', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'NVDA',
          'META', 'NFLX', 'AMD', 'INTC', 'SPY', 'QQQ'
        ],
        majorExchanges: ['NASDAQ', 'NYSE', 'AMEX'],
        marketHours: {
          timezone: 'America/New_York',
          open: '09:30',
          close: '16:00',
          lunchBreak: false
        },
        ...config
      };

      this.isInitialized = true;
      this.logger.info('✅ Stock data feed initialized');

    } catch (error) {
      this.logger.error('Failed to initialize stock data feed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get real-time stock price
   */
  async getStockPrice(symbol) {
    try {
      if (!Validator.isValidAssetSymbol(symbol, 'stock')) {
        throw new Error(`Invalid stock symbol: ${symbol}`);
      }

      const priceData = await this.tradingViewAPI.getRealTimePrice(symbol, 'stock');

      // Add stock-specific data
      const stockInfo = this.getStockInfo(symbol);
      const marketStatus = this.tradingViewAPI.getMarketStatus('stock', symbol);

      return {
        ...priceData,
        asset_type: 'stock',
        info: stockInfo,
        market_status: marketStatus,
        // Stock-specific metrics
        pe_ratio: stockInfo?.pe_ratio,
        dividend_yield: stockInfo?.dividend_yield,
        market_cap: priceData.marketCap,
        average_volume: stockInfo?.average_volume,
        volatility: stockInfo?.volatility
      };

    } catch (error) {
      this.logger.error('Error getting stock price', { symbol, error: error.message });
      throw ErrorHandler.handle(error, { service: 'stock_data_feed', symbol });
    }
  }

  /**
   * Get stock historical data
   */
  async getStockHistory(symbol, timeframe = '1D', barsCount = 100) {
    try {
      if (!Validator.isValidAssetSymbol(symbol, 'stock')) {
        throw new Error(`Invalid stock symbol: ${symbol}`);
      }

      const historicalData = await this.tradingViewAPI.getHistoricalData(symbol, 'stock', timeframe, barsCount);

      // Add stock-specific analysis
      const analysis = this.analyzeStockData(historicalData.candles);

      return {
        ...historicalData,
        asset_type: 'stock',
        analysis,
        indicators: this.calculateStockIndicators(historicalData.candles)
      };

    } catch (error) {
      this.logger.error('Error getting stock history', { symbol, timeframe, barsCount, error: error.message });
      throw ErrorHandler.handle(error, { service: 'stock_data_feed', symbol, timeframe });
    }
  }

  /**
   * Get multiple stock prices
   */
  async getMultipleStockPrices(symbols) {
    try {
      const validSymbols = symbols.filter(symbol => Validator.isValidAssetSymbol(symbol, 'stock'));

      if (validSymbols.length === 0) {
        throw new Error('No valid stock symbols provided');
      }

      const promises = validSymbols.map(symbol => this.getStockPrice(symbol));
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
      this.logger.error('Error getting multiple stock prices', { symbols, error: error.message });
      throw error;
    }
  }

  /**
   * Get stock market overview
   */
  async getMarketOverview() {
    try {
      // Get major indices
      const indices = ['SPY', 'QQQ'];
      const indexPromises = indices.map(symbol => this.getStockPrice(symbol));
      const indexResults = await Promise.allSettled(indexPromises);

      // Get popular stocks
      const popularStocks = this.config.popularStocks.slice(0, 5);
      const stockPromises = popularStocks.map(symbol => this.getStockPrice(symbol));
      const stockResults = await Promise.allSettled(stockPromises);

      // Calculate market sentiment
      const successfulIndices = indexResults.filter(r => r.status === 'fulfilled').map(r => r.value);
      const successfulStocks = stockResults.filter(r => r.status === 'fulfilled').map(r => r.value);

      const marketSentiment = this.calculateMarketSentiment([...successfulIndices, ...successfulStocks]);

      return {
        timestamp: new Date(),
        indices: successfulIndices,
        popular_stocks: successfulStocks,
        market_sentiment: marketSentiment,
        market_status: this.tradingViewAPI.getMarketStatus('stock'),
        total_symbols_requested: indices.length + popularStocks.length,
        total_symbols_successful: successfulIndices.length + successfulStocks.length
      };

    } catch (error) {
      this.logger.error('Error getting market overview', { error: error.message });
      throw error;
    }
  }

  /**
   * Get stock information from config
   */
  getStockInfo(symbol) {
    const assets = require('../../config/assets.json');
    return assets.stocks?.[symbol] || null;
  }

  /**
   * Analyze stock data for patterns
   */
  analyzeStockData(candles) {
    if (!Array.isArray(candles) || candles.length < 2) {
      return { patterns: [], trends: {} };
    }

    const patterns = [];
    const trends = {
      direction: 'sideways',
      strength: 'weak',
      volatility: 'low'
    };

    // Analyze recent price action
    const recentCandles = candles.slice(-20); // Last 20 candles
    const prices = recentCandles.map(c => c.close);
    const volumes = recentCandles.map(c => c.volume);

    // Trend analysis
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    if (Math.abs(priceChange) < 0.5) {
      trends.direction = 'sideways';
    } else if (priceChange > 2) {
      trends.direction = 'bullish';
    } else if (priceChange < -2) {
      trends.direction = 'bearish';
    }

    // Volatility analysis
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized

    if (volatility > 0.5) trends.volatility = 'high';
    else if (volatility > 0.25) trends.volatility = 'medium';

    // Volume analysis
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const recentVolume = volumes[volumes.length - 1];

    if (recentVolume > avgVolume * 1.5) {
      patterns.push('high_volume');
    }

    // Price patterns
    if (this.isHammer(candles.slice(-1)[0])) {
      patterns.push('hammer_candle');
    }

    if (this.isDoji(candles.slice(-1)[0])) {
      patterns.push('doji_candle');
    }

    return {
      patterns,
      trends,
      price_change_percent: priceChange,
      volatility,
      volume_trend: recentVolume > avgVolume ? 'increasing' : 'decreasing'
    };
  }

  /**
   * Calculate stock-specific indicators
   */
  calculateStockIndicators(candles) {
    // This would calculate stock-specific indicators
    // For now, return basic structure
    return {
      volume_sma: 0, // Simple moving average of volume
      price_volume_trend: 0, // Price-volume trend indicator
      money_flow_index: 0, // Money flow index
      ease_of_movement: 0 // Ease of movement indicator
    };
  }

  /**
   * Calculate market sentiment
   */
  calculateMarketSentiment(assets) {
    if (!Array.isArray(assets) || assets.length === 0) {
      return { sentiment: 'neutral', score: 0 };
    }

    let positiveCount = 0;
    let totalChange = 0;

    assets.forEach(asset => {
      if (asset.changePercent > 0) positiveCount++;
      totalChange += asset.changePercent;
    });

    const positiveRatio = positiveCount / assets.length;
    const avgChange = totalChange / assets.length;

    let sentiment = 'neutral';
    let score = 0;

    if (positiveRatio > 0.6 && avgChange > 0.5) {
      sentiment = 'bullish';
      score = Math.min(100, positiveRatio * 100);
    } else if (positiveRatio < 0.4 && avgChange < -0.5) {
      sentiment = 'bearish';
      score = Math.min(100, Math.abs(positiveRatio - 1) * 100);
    }

    return {
      sentiment,
      score: Math.round(score),
      positive_assets: positiveCount,
      total_assets: assets.length,
      average_change: avgChange.toFixed(2)
    };
  }

  /**
   * Check if candle is a hammer pattern
   */
  isHammer(candle) {
    const { open, high, low, close } = candle;
    const body = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    const totalRange = high - low;

    // Hammer: small body, long lower shadow, small upper shadow
    return body / totalRange < 0.3 && lowerShadow / totalRange > 0.6;
  }

  /**
   * Check if candle is a doji pattern
   */
  isDoji(candle) {
    const { open, high, low, close } = candle;
    const body = Math.abs(close - open);
    const totalRange = high - low;

    // Doji: very small body relative to total range
    return body / totalRange < 0.05;
  }

  /**
   * Search stocks by query
   */
  async searchStocks(query, limit = 10) {
    return await this.tradingViewAPI.searchSymbols(query, 'stock', limit);
  }

  /**
   * Get stock news/sentiment (placeholder)
   */
  async getStockSentiment(symbol) {
    // This would integrate with news APIs or sentiment analysis
    // For now, return mock data
    return {
      symbol,
      sentiment_score: Math.random() * 200 - 100, // -100 to 100
      news_count: Math.floor(Math.random() * 10),
      social_mentions: Math.floor(Math.random() * 1000),
      analyst_rating: ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'][Math.floor(Math.random() * 5)]
    };
  }

  /**
   * Get stock fundamentals (placeholder)
   */
  async getStockFundamentals(symbol) {
    const stockInfo = this.getStockInfo(symbol);

    if (!stockInfo) {
      throw new Error(`Stock information not found for ${symbol}`);
    }

    // Mock fundamental data - in production, integrate with financial APIs
    return {
      symbol,
      market_cap: stockInfo.average_volume * stockInfo.volatility * 1000000, // Mock calculation
      pe_ratio: Math.random() * 50 + 10,
      pb_ratio: Math.random() * 5 + 0.5,
      dividend_yield: Math.random() * 5,
      eps: Math.random() * 20 - 10,
      revenue: Math.random() * 1000000000,
      profit_margin: (Math.random() * 40) - 20,
      debt_to_equity: Math.random() * 2,
      return_on_equity: Math.random() * 30,
      beta: Math.random() * 3 - 0.5
    };
  }

  /**
   * Get stock performance metrics
   */
  async getStockPerformance(symbol, period = '1Y') {
    try {
      const history = await this.getStockHistory(symbol, '1D', 365); // 1 year of daily data
      const prices = history.candles.map(c => c.close);

      if (prices.length < 2) {
        throw new Error('Insufficient data for performance calculation');
      }

      const startPrice = prices[0];
      const endPrice = prices[prices.length - 1];
      const totalReturn = ((endPrice - startPrice) / startPrice) * 100;

      // Calculate volatility
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }

      const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized

      // Calculate Sharpe ratio (assuming 2% risk-free rate)
      const sharpeRatio = volatility > 0 ? (avgReturn * 252 - 0.02) / volatility : 0;

      return {
        symbol,
        period,
        start_price: startPrice,
        end_price: endPrice,
        total_return_percent: totalReturn,
        annualized_return: totalReturn, // Simplified
        volatility: volatility * 100, // Convert to percentage
        sharpe_ratio: sharpeRatio,
        max_drawdown: this.calculateMaxDrawdown(prices),
        best_day: Math.max(...returns) * 100,
        worst_day: Math.min(...returns) * 100
      };

    } catch (error) {
      this.logger.error('Error calculating stock performance', { symbol, period, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(prices) {
    let maxDrawdown = 0;
    let peak = prices[0];

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > peak) {
        peak = prices[i];
      } else {
        const drawdown = (peak - prices[i]) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    return maxDrawdown * 100; // Convert to percentage
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      service: 'stock_data_feed',
      tradingview_api: this.tradingViewAPI.getHealth()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.tradingViewAPI.cleanup();
    this.logger.info('✅ Stock data feed cleaned up');
  }
}

module.exports = StockDataFeed;