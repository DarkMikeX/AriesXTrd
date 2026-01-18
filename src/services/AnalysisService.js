/**
 * Analysis Service
 * Handles asset analysis requests and coordinates with technical indicators
 */

const TechnicalIndicators = require('../indicators/TechnicalIndicators');
const StockDataFeed = require('../data/StockDataFeed');
const ForexDataFeed = require('../data/ForexDataFeed');
const CryptoDataFeed = require('../data/CryptoDataFeed');
const TradingViewAPI = require('../data/TradingViewAPI');

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Formatter = require('../utils/Formatter');
const Validator = require('../utils/Validator');

class AnalysisService {
  constructor(database = null) {
    this.database = database;
    this.logger = Logger.getInstance();
    this.formatter = new Formatter();
    this.technicalIndicators = new TechnicalIndicators();
    this.isInitialized = false;

    // Data feeds for different asset types
    this.dataFeeds = {};
  }

  /**
   * Initialize the analysis service
   */
  async initialize() {
    try {
      // Initialize data feeds
      this.dataFeeds.stock = new StockDataFeed();
      this.dataFeeds.forex = new ForexDataFeed();
      this.dataFeeds.crypto = new CryptoDataFeed();

      // Initialize all data feeds
      for (const [type, feed] of Object.entries(this.dataFeeds)) {
        await feed.initialize();
        this.logger.info(`✅ ${type} data feed initialized`);
      }

      this.isInitialized = true;
      this.logger.info('✅ Analysis service initialized');

    } catch (error) {
      this.logger.error('Failed to initialize analysis service', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze an asset
   */
  async analyzeAsset(assetSymbol, options = {}) {
    try {
      const {
        assetType = 'stock',
        timeframe = '1D',
        userId = null,
        includeCharts = false,
        customWeights = null
      } = options;

      // Validate inputs
      if (!Validator.isValidAssetSymbol(assetSymbol, assetType)) {
        throw new Error(`Invalid ${assetType} symbol: ${assetSymbol}`);
      }

      this.logger.info('Starting asset analysis', { assetSymbol, assetType, timeframe, userId });

      // Get market data
      const marketData = await this.getMarketData(assetSymbol, assetType, timeframe);
      if (!marketData) {
        throw new Error(`Failed to get market data for ${assetSymbol}`);
      }

      // Perform technical analysis
      const analysis = await this.technicalIndicators.analyzeAsset(assetSymbol, assetType, {
        data: marketData,
        timeframe,
        includeCharts,
        customWeights
      });

      // Validate analysis result
      const validation = this.technicalIndicators.validateAnalysis(analysis);
      if (!validation.valid) {
        throw new Error(`Analysis validation failed: ${validation.error}`);
      }

      // Save analysis to database if user provided
      if (userId && this.database) {
        await this.saveAnalysisToDatabase(userId, analysis);
      }

      // Format result for display
      const formattedResult = this.formatAnalysisResult(analysis);

      this.logger.info('Asset analysis completed', {
        assetSymbol,
        assetType,
        signal: analysis.signal.signal,
        confidence: analysis.signal.confidence
      });

      return {
        ...analysis,
        formatted: formattedResult
      };

    } catch (error) {
      this.logger.info('Error analyzing asset', { assetSymbol, options, error: error.message });
      throw ErrorHandler.handle(error, { service: 'analysis_service', assetSymbol, ...options });
    }
  }

  /**
   * Get market data for analysis
   */
  async getMarketData(assetSymbol, assetType, timeframe) {
    try {
      const dataFeed = this.dataFeeds[assetType];
      if (!dataFeed) {
        throw new Error(`Unsupported asset type: ${assetType}`);
      }

      // Get real-time price and historical data based on asset type
      let priceData, historicalData;

      if (assetType === 'stock') {
        priceData = await dataFeed.getStockPrice(assetSymbol);
        historicalData = await dataFeed.getStockHistory(assetSymbol, timeframe, 100);
      } else if (assetType === 'forex') {
        priceData = await dataFeed.getForexPrice(assetSymbol);
        historicalData = await dataFeed.getForexHistory(assetSymbol, timeframe, 100);
      } else if (assetType === 'crypto') {
        priceData = await dataFeed.getCryptoPrice(assetSymbol);
        historicalData = await dataFeed.getCryptoHistory(assetSymbol, timeframe, 100);
      } else {
        throw new Error(`Invalid asset type: ${assetType}`);
      }

      // Extract candle data (OHLCV) for analysis
      const candles = historicalData.candles || [];
      
      return {
        current_price: priceData.price,
        price_data: priceData, // Contains source for real-time price
        historical_data: {
          source: historicalData.source || 'free_api', // Store historical data source
          candles: candles
        },
        candles: candles, // Full OHLCV candle data
        highs: candles.map(c => c.high) || [],
        lows: candles.map(c => c.low) || [],
        opens: candles.map(c => c.open) || [],
        closes: candles.map(c => c.close) || [],
        volumes: candles.map(c => c.volume) || [],
        timestamps: candles.map(c => c.timestamp) || [],
        analysis: historicalData.analysis,
        timeframe: timeframe
      };

    } catch (error) {
      this.logger.error('Error getting market data', { assetSymbol, assetType, timeframe, error: error.message });
      return null;
    }
  }

  /**
   * Save analysis result to database
   */
  async saveAnalysisToDatabase(userId, analysis) {
    try {
      if (!this.database) return;

      const Signal = this.database.getModel('Signal');

      // Create signal record
      await Signal.create({
        user_id: userId,
        asset_symbol: analysis.asset.symbol,
        asset_name: analysis.asset.symbol, // Would be populated from asset data
        asset_type: analysis.asset.type,
        signal_type: analysis.signal.signal,
        trade_type: analysis.signal.type,
        confidence_score: analysis.signal.confidence,
        strength: analysis.signal.strength,
        current_price: analysis.market_data.current_price,
        indicators: analysis.indicators,
        strategy_used: 'multi_indicator',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      this.logger.info('Analysis saved to database', {
        userId,
        asset: analysis.asset.symbol,
        signal: analysis.signal.signal
      });

    } catch (error) {
      this.logger.error('Error saving analysis to database', { error: error.message });
      // Don't throw - analysis should still work even if saving fails
    }
  }

  /**
   * Format analysis result for display
   */
  formatAnalysisResult(analysis) {
    try {
      const { asset, market_data, signal, indicators } = analysis;

      // Create indicator summary
      const indicatorSummary = this.createIndicatorSummary(indicators);

      // Create signal description
      const signalDescription = this.createSignalDescription(signal, indicatorSummary);

      // Create trade recommendation
      const tradeRecommendation = this.createTradeRecommendation(signal, market_data.current_price);

      return {
        header: `📊 ${asset.symbol} ANALYSIS COMPLETE`,
        price_info: `💰 Current Price: $${this.formatter.formatCurrency(market_data.current_price)}`,
        indicators_summary: indicatorSummary,
        signal_info: signalDescription,
        trade_recommendation: tradeRecommendation,
        summary: {
          signal: signal.signal,
          confidence: `${signal.confidence}%`,
          quality: signal.quality,
          strength: signal.strength
        }
      };

    } catch (error) {
      this.logger.error('Error formatting analysis result', { error: error.message });
      return {
        header: '❌ Error formatting analysis result',
        error: error.message
      };
    }
  }

  /**
   * Create indicator summary for display
   */
  createIndicatorSummary(indicators) {
    const summary = [];

    // RSI
    if (indicators.rsi && indicators.rsi.rsi) {
      const rsiValue = indicators.rsi.rsi.toFixed(1);
      const rsiSignal = indicators.rsi.signal === 'oversold' ? '✅' :
                        indicators.rsi.signal === 'overbought' ? '🔴' : '🟡';
      summary.push(`├─ RSI (14): ${rsiValue} ${rsiSignal}`);
    }

    // MACD
    if (indicators.macd && indicators.macd.macd) {
      const macdSignal = indicators.macd.signal.includes('bullish') ? '✅' :
                         indicators.macd.signal.includes('bearish') ? '🔴' : '🟡';
      summary.push(`├─ MACD: ${indicators.macd.signal} ${macdSignal}`);
    }

    // Bollinger Bands
    if (indicators.bollingerBands && indicators.bollingerBands.percentB !== null) {
      const bbSignal = indicators.bollingerBands.signal.includes('lower') ? '✅' :
                       indicators.bollingerBands.signal.includes('upper') ? '🔴' : '🟡';
      summary.push(`├─ Bollinger: ${indicators.bollingerBands.signal} ${bbSignal}`);
    }

    // EMA
    if (indicators.ema20 && indicators.ema20.ema) {
      const emaSignal = indicators.ema20.signal.includes('above') ? '✅' :
                        indicators.ema20.signal.includes('below') ? '🔴' : '🟡';
      summary.push(`├─ 50 EMA: ${indicators.ema20.signal} ${emaSignal}`);
    }

    // SMA
    if (indicators.sma50 && indicators.sma50.sma) {
      const smaSignal = indicators.sma50.signal.includes('above') ? '✅' :
                        indicators.sma50.signal.includes('below') ? '🔴' : '🟡';
      summary.push(`├─ 200 SMA: ${indicators.sma50.signal} ${smaSignal}`);
    }

    // Stochastic
    if (indicators.stochastic && indicators.stochastic.k) {
      const stochSignal = indicators.stochastic.signal === 'oversold' ? '✅' :
                          indicators.stochastic.signal === 'overbought' ? '🔴' : '🟡';
      const kValue = indicators.stochastic.k.toFixed(1);
      summary.push(`├─ Stochastic: ${kValue} ${stochSignal}`);
    }

    // Volume
    if (indicators.volume && indicators.volume.signal) {
      const volSignal = indicators.volume.signal.includes('uptrend') ? '✅' :
                        indicators.volume.signal.includes('downtrend') ? '🔴' : '🟡';
      const volStrength = indicators.volume.volume_strength ?
                         `${indicators.volume.volume_strength.toFixed(1)}x` : '';
      summary.push(`└─ Volume: ${volStrength} ${volSignal}`);
    }

    return summary.length > 0 ? `📈 TECHNICAL INDICATORS:\n${summary.join('\n')}` : '';
  }

  /**
   * Create signal description
   */
  createSignalDescription(signal, indicatorSummary) {
    const { signal: signalType, type, confidence, strength, quality } = signal;

    if (signalType === 'WAIT') {
      return `🎯 SIGNAL: WAIT\n📊 Confidence: ${confidence}%\n⭐ Quality: ${quality}`;
    }

    const direction = type === 'CALL' ? 'Price will go UP' : 'Price will go DOWN';
    const signalEmoji = signalType === 'BUY' ? '🟢' : '🔴';

    return `🎯 SIGNAL: ${strength} ${signalType} (${type}) ${signalEmoji}\n📊 Confidence: ${confidence}%\n⭐ Quality: ${quality}\n💡 Direction: ${direction}`;
  }

  /**
   * Create trade recommendation
   */
  createTradeRecommendation(signal, currentPrice) {
    if (signal.signal === 'WAIT') {
      return '💡 TRADE RECOMMENDATION:\nWait for clearer signals before trading.';
    }

    const amount = 5; // Default amount
    const payout = 0.95; // 95% payout
    const potentialProfit = (amount * payout).toFixed(2);

    return `💡 RECOMMENDED TRADE:
Direction: ${signal.type} (${signal.type === 'CALL' ? 'Price will go UP' : 'Price will go DOWN'})
Amount: $${amount}
Duration: 5 minutes
Potential Profit: $${potentialProfit} (${payout * 100}% payout)`;
  }

  /**
   * Get analysis history for user
   */
  async getAnalysisHistory(userId, options = {}) {
    try {
      const { limit = 10, assetType = null, signalType = null } = options;

      if (!this.database) {
        throw new Error('Database not available');
      }

      const Signal = this.database.getModel('Signal');
      const whereClause = { user_id: userId };

      if (assetType) whereClause.asset_type = assetType;
      if (signalType) whereClause.signal_type = signalType;

      const signals = await Signal.findAll({
        where: whereClause,
        limit,
        order: [['created_at', 'DESC']],
        attributes: [
          'id', 'asset_symbol', 'signal_type', 'confidence_score',
          'strength', 'current_price', 'created_at', 'executed_at'
        ]
      });

      return signals.map(signal => ({
        id: signal.id,
        asset: signal.asset_symbol,
        signal: signal.signal_type,
        confidence: signal.confidence_score,
        strength: signal.strength,
        price: signal.current_price,
        created_at: signal.created_at,
        executed_at: signal.executed_at,
        is_executed: !!signal.executed_at
      }));

    } catch (error) {
      this.logger.error('Error getting analysis history', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get popular assets for analysis
   */
  getPopularAssets(assetType = 'stock') {
    const assets = require('../../config/assets.json');

    if (!assets[assetType]) return [];

    const assetList = Object.values(assets[assetType]);
    return assetList
      .filter(asset => asset.enabled)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10)
      .map(asset => ({
        symbol: Object.keys(assets[assetType]).find(key => assets[assetType][key] === asset),
        name: asset.name,
        type: assetType
      }));
  }

  /**
   * Search for assets
   */
  async searchAssets(query, assetType = null, limit = 10) {
    try {
      const TradingViewAPI = require('../data/TradingViewAPI');
      const tradingView = new TradingViewAPI();

      return await tradingView.searchSymbols(query, assetType, limit);
    } catch (error) {
      this.logger.error('Error searching assets', { query, assetType, error: error.message });
      return [];
    }
  }

  /**
   * Get asset information
   */
  getAssetInfo(symbol, assetType = null) {
    const TradingViewAPI = require('../data/TradingViewAPI');
    const tradingView = new TradingViewAPI();

    return tradingView.getAssetInfo(symbol, assetType);
  }

  /**
   * Get market status
   */
  getMarketStatus(assetType, symbol = null) {
    const TradingViewAPI = require('../data/TradingViewAPI');
    const tradingView = new TradingViewAPI();

    return tradingView.getMarketStatus(assetType, symbol);
  }

  /**
   * Validate analysis request
   */
  validateAnalysisRequest(assetSymbol, assetType, options = {}) {
    const errors = [];

    if (!Validator.isValidAssetSymbol(assetSymbol, assetType)) {
      errors.push(`Invalid ${assetType} symbol: ${assetSymbol}`);
    }

    const validTimeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];
    if (options.timeframe && !validTimeframes.includes(options.timeframe)) {
      errors.push(`Invalid timeframe: ${options.timeframe}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get supported asset types
   */
  getSupportedAssetTypes() {
    return Object.keys(this.dataFeeds);
  }

  /**
   * Get supported timeframes
   */
  getSupportedTimeframes() {
    return ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];
  }

  /**
   * Get service health
   */
  getHealth() {
    const health = {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      technical_indicators: this.technicalIndicators.getHealth(),
      data_feeds: {}
    };

    for (const [type, feed] of Object.entries(this.dataFeeds)) {
      health.data_feeds[type] = feed.getHealth();
    }

    return health;
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(userId = null, period = '7d') {
    try {
      if (!this.database) return null;

      const Signal = this.database.getModel('Signal');
      const whereClause = {};

      if (userId) whereClause.user_id = userId;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case '1d':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      whereClause.created_at = {
        [this.database.getSequelize().Op.between]: [startDate, endDate]
      };

      const signals = await Signal.findAll({
        where: whereClause,
        attributes: [
          'signal_type',
          'confidence_score',
          'strength',
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'count']
        ],
        group: ['signal_type', 'confidence_score', 'strength']
      });

      const stats = {
        period,
        total_analyses: 0,
        signals: {
          BUY: 0,
          SELL: 0,
          HOLD: 0,
          WAIT: 0
        },
        confidence_distribution: {
          high: 0,    // 80-100%
          medium: 0,  // 60-79%
          low: 0      // 0-59%
        },
        strength_distribution: {
          STRONG: 0,
          MODERATE: 0,
          WEAK: 0
        }
      };

      signals.forEach(signal => {
        const count = parseInt(signal.dataValues.count);
        stats.total_analyses += count;

        // Signal types
        if (stats.signals.hasOwnProperty(signal.signal_type)) {
          stats.signals[signal.signal_type] += count;
        }

        // Confidence distribution
        const confidence = signal.confidence_score;
        if (confidence >= 80) stats.confidence_distribution.high += count;
        else if (confidence >= 60) stats.confidence_distribution.medium += count;
        else stats.confidence_distribution.low += count;

        // Strength distribution
        if (stats.strength_distribution.hasOwnProperty(signal.strength)) {
          stats.strength_distribution[signal.strength] += count;
        }
      });

      return stats;

    } catch (error) {
      this.logger.error('Error getting analysis stats', { userId, period, error: error.message });
      return null;
    }
  }

  /**
   * Clear analysis cache
   */
  clearCache(pattern = null) {
    // This would clear any cached analysis results
    this.logger.info('Analysis cache cleared', { pattern });
  }

  /**
   * Update analysis settings
   */
  updateSettings(settings) {
    // Update analysis service settings
    this.logger.info('Analysis settings updated', settings);
  }
}

module.exports = AnalysisService;