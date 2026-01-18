/**
 * Technical Indicators Service
 * Combines all technical indicators and implements signal generation algorithm
 */

const RSI = require('./RSI');
const MACD = require('./MACD');
const BollingerBands = require('./BollingerBands');
const EMA = require('./EMA');
const SMA = require('./SMA');
const Stochastic = require('./Stochastic');
const ATR = require('./ATR');
const VolumeAnalyzer = require('./VolumeAnalyzer');

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');

class TechnicalIndicators {
  constructor() {
    this.logger = Logger.getInstance();
    this.indicators = {};
    this.isInitialized = false;

    // Initialize all indicators with default settings
    this.initializeIndicators();
  }

  /**
   * Initialize all technical indicators
   */
  initializeIndicators() {
    try {
      this.indicators = {
        rsi: new RSI(14),
        macd: new MACD(12, 26, 9),
        bollingerBands: new BollingerBands(20, 2),
        ema: new EMA(20),
        sma: new SMA(50),
        stochastic: new Stochastic(14, 3),
        atr: new ATR(14),
        volumeAnalyzer: new VolumeAnalyzer(20)
      };

      this.isInitialized = true;
      this.logger.info('✅ Technical indicators initialized');

    } catch (error) {
      this.logger.error('Failed to initialize technical indicators', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze asset with all indicators
   */
  async analyzeAsset(assetSymbol, assetType = 'stock', options = {}) {
    try {
      const {
        data = null,
        timeframe = '1D',
        includeCharts = false,
        customWeights = null
      } = options;

      // Get data if not provided
      let marketData = data;
      if (!marketData) {
        marketData = await this.getMarketData(assetSymbol, assetType, timeframe);
      }

      if (!marketData) {
        throw new Error(`Failed to get market data for ${assetSymbol}`);
      }

      // Calculate all indicators
      const indicatorResults = await this.calculateAllIndicators(marketData, assetType);

      // Generate signal using the algorithm from specification
      const signal = this.generateSignal(indicatorResults, customWeights);

      // Create analysis result
      // Preserve original market_data structure (including source info) while adding new fields
      const analysis = {
        asset: {
          symbol: assetSymbol,
          type: assetType,
          timeframe
        },
        market_data: {
          ...marketData, // Preserve all original market data (including historical_data.source, price_data.source)
          current_price: marketData.current_price,
          timestamp: new Date(),
          data_points: marketData.candles?.length || 0
        },
        indicators: indicatorResults,
        signal,
        metadata: {
          analysis_timestamp: new Date(),
          indicators_used: Object.keys(indicatorResults),
          algorithm_version: '1.0'
        }
      };

      this.logger.info('Signal generated', {
        symbol: assetSymbol,
        signal: signal.signal,
        confidence: signal.confidence,
        assetType,
        timeframe,
        indicatorCount: Object.keys(indicatorResults).length
      });

      return analysis;

    } catch (error) {
      this.logger.error('Error analyzing asset', { assetSymbol, assetType, error: error.message });
      throw ErrorHandler.handle(error, { service: 'technical_indicators', assetSymbol, assetType });
    }
  }

  /**
   * Get market data for analysis
   */
  async getMarketData(assetSymbol, assetType, timeframe) {
    try {
      // Import data services dynamically to avoid circular dependencies
      const TradingViewAPI = require('../data/TradingViewAPI');
      const tradingView = new TradingViewAPI();

      // Get real-time price
      const priceData = await tradingView.getRealTimePrice(assetSymbol, assetType);

      // Get historical data for indicators
      const historicalData = await tradingView.getHistoricalData(assetSymbol, assetType, timeframe, 100);

      return {
        current_price: priceData.price,
        price_data: priceData,
        historical_data: historicalData,
        candles: historicalData.candles,
        highs: historicalData.candles?.map(c => c.high) || [],
        lows: historicalData.candles?.map(c => c.low) || [],
        closes: historicalData.candles?.map(c => c.close) || [],
        volumes: historicalData.candles?.map(c => c.volume) || []
      };

    } catch (error) {
      this.logger.error('Error getting market data', { assetSymbol, assetType, error: error.message });
      return null;
    }
  }

  /**
   * Calculate all indicators for the given market data
   */
  async calculateAllIndicators(marketData, assetType) {
    const results = {};
    const { highs, lows, closes, volumes } = marketData;

    try {
      // RSI
      results.rsi = this.indicators.rsi.calculate(closes);

      // MACD
      results.macd = this.indicators.macd.calculate(closes);

      // Bollinger Bands
      results.bollingerBands = this.indicators.bollingerBands.calculate(closes);

      // EMA (20)
      results.ema20 = this.indicators.ema.calculate(closes);

      // SMA (50)
      results.sma50 = this.indicators.sma.calculate(closes);

      // Stochastic
      results.stochastic = this.indicators.stochastic.calculate(highs, lows, closes);

      // ATR
      results.atr = this.indicators.atr.calculate(highs, lows, closes);

      // Volume Analysis
      results.volume = this.indicators.volumeAnalyzer.analyze(volumes, closes, highs, lows);

      // Calculate additional EMAs and SMAs for ribbon analysis
      results.ema50 = new EMA(50).calculate(closes);
      results.ema200 = new EMA(200).calculate(closes);
      results.sma100 = new SMA(100).calculate(closes);
      results.sma200 = new SMA(200).calculate(closes);

    } catch (error) {
      this.logger.error('Error calculating indicators', { error: error.message });
      // Continue with partial results
    }

    return results;
  }

  /**
   * Generate trading signal using the algorithm from specification
   */
  generateSignal(indicatorResults, customWeights = null) {
    try {
      // Default weights for each indicator (as per specification algorithm)
      const weights = customWeights || {
        rsi: 1,
        macd: 2,
        bollingerBands: 1,
        ema20: 1,
        sma50: 1,
        stochastic: 1,
        volume: 1
      };

      let buyPoints = 0;
      let sellPoints = 0;
      const signals = [];

      // 1. RSI Analysis
      if (indicatorResults.rsi && indicatorResults.rsi.signal !== 'insufficient_data') {
        const rsiSignal = this.getRSISignalPoints(indicatorResults.rsi);
        buyPoints += rsiSignal.buyPoints * weights.rsi;
        sellPoints += rsiSignal.sellPoints * weights.rsi;
        signals.push({
          indicator: 'RSI',
          signal: indicatorResults.rsi.signal,
          strength: indicatorResults.rsi.strength,
          value: indicatorResults.rsi.rsi
        });
      }

      // 2. MACD Analysis
      if (indicatorResults.macd && indicatorResults.macd.signal !== 'insufficient_data') {
        const macdSignal = this.getMACDSignalPoints(indicatorResults.macd);
        buyPoints += macdSignal.buyPoints * weights.macd;
        sellPoints += macdSignal.sellPoints * weights.macd;
        const macdValue = indicatorResults.macd.macd ? indicatorResults.macd.macd.toFixed(4) : 'N/A';
        const signalLine = indicatorResults.macd.signalLine ? indicatorResults.macd.signalLine.toFixed(4) : 'N/A';
        signals.push({
          indicator: 'MACD',
          signal: indicatorResults.macd.signal,
          strength: indicatorResults.macd.strength,
          value: `${macdValue}/${signalLine}`
        });
      }

      // 3. Bollinger Bands Analysis
      if (indicatorResults.bollingerBands && indicatorResults.bollingerBands.signal !== 'insufficient_data') {
        const bbSignal = this.getBollingerBandsSignalPoints(indicatorResults.bollingerBands);
        buyPoints += bbSignal.buyPoints * weights.bollingerBands;
        sellPoints += bbSignal.sellPoints * weights.bollingerBands;
        signals.push({
          indicator: 'Bollinger Bands',
          signal: indicatorResults.bollingerBands.signal,
          strength: indicatorResults.bollingerBands.strength,
          value: `BB: ${indicatorResults.bollingerBands.percentB?.toFixed(2)}`
        });
      }

      // 4. EMA Analysis (20-period)
      if (indicatorResults.ema20 && indicatorResults.ema20.signal !== 'insufficient_data') {
        const emaSignal = this.getEMASignalPoints(indicatorResults.ema20);
        buyPoints += emaSignal.buyPoints * weights.ema20;
        sellPoints += emaSignal.sellPoints * weights.ema20;
        signals.push({
          indicator: 'EMA(20)',
          signal: indicatorResults.ema20.signal,
          strength: indicatorResults.ema20.strength,
          value: indicatorResults.ema20.ema?.toFixed(4)
        });
      }

      // 5. SMA Analysis (50-period)
      if (indicatorResults.sma50 && indicatorResults.sma50.signal !== 'insufficient_data') {
        const smaSignal = this.getSMASignalPoints(indicatorResults.sma50);
        buyPoints += smaSignal.buyPoints * weights.sma50;
        sellPoints += smaSignal.sellPoints * weights.sma50;
        signals.push({
          indicator: 'SMA(50)',
          signal: indicatorResults.sma50.signal,
          strength: indicatorResults.sma50.strength,
          value: indicatorResults.sma50.sma?.toFixed(4)
        });
      }

      // 6. Stochastic Analysis
      if (indicatorResults.stochastic && indicatorResults.stochastic.signal !== 'insufficient_data') {
        const stochSignal = this.getStochasticSignalPoints(indicatorResults.stochastic);
        buyPoints += stochSignal.buyPoints * weights.stochastic;
        sellPoints += stochSignal.sellPoints * weights.stochastic;
        signals.push({
          indicator: 'Stochastic',
          signal: indicatorResults.stochastic.signal,
          strength: indicatorResults.stochastic.strength,
          value: `K:${indicatorResults.stochastic.k?.toFixed(1)} D:${indicatorResults.stochastic.d?.toFixed(1)}`
        });
      }

      // 7. Volume Analysis
      if (indicatorResults.volume && indicatorResults.volume.volume_trend !== 'insufficient_data') {
        const volumeSignal = this.getVolumeSignalPoints(indicatorResults.volume);
        buyPoints += volumeSignal.buyPoints * weights.volume;
        sellPoints += volumeSignal.sellPoints * weights.volume;
        signals.push({
          indicator: 'Volume',
          signal: indicatorResults.volume.signal,
          strength: indicatorResults.volume.strength,
          value: `${indicatorResults.volume.volume_strength?.toFixed(1)}x avg`
        });
      }

      // Calculate confidence and determine final signal
      const totalPoints = buyPoints + sellPoints;
      let confidence = 0;
      let signal = 'WAIT';
      let type = 'NONE';
      let strength = 'WEAK';
      let quality = 'Poor';

      if (totalPoints > 0) {
        confidence = Math.round((Math.max(buyPoints, sellPoints) / totalPoints) * 100);

        // Cap confidence at 95% as per specification
        confidence = Math.min(confidence, 95);

        if (buyPoints > sellPoints && confidence >= 75) {
          signal = 'BUY';
          type = 'CALL';
          strength = buyPoints >= 7 ? 'STRONG' : 'MODERATE';
          quality = confidence >= 85 ? 'Excellent' : confidence >= 75 ? 'Good' : 'Fair';
        } else if (sellPoints > buyPoints && confidence >= 75) {
          signal = 'SELL';
          type = 'PUT';
          strength = sellPoints >= 7 ? 'STRONG' : 'MODERATE';
          quality = confidence >= 85 ? 'Excellent' : confidence >= 75 ? 'Good' : 'Fair';
        }
      }

      return {
        signal,
        type,
        confidence,
        strength,
        quality,
        points: {
          buy: buyPoints,
          sell: sellPoints,
          total: totalPoints
        },
        indicators: signals,
        algorithm: {
          version: '1.0',
          weights,
          threshold: 75
        }
      };

    } catch (error) {
      this.logger.error('Error generating signal', { error: error.message });
      return {
        signal: 'ERROR',
        type: 'NONE',
        confidence: 0,
        strength: 'ERROR',
        quality: 'Error',
        error: error.message
      };
    }
  }

  /**
   * Get RSI signal points for the algorithm
   */
  getRSISignalPoints(rsiResult) {
    let buyPoints = 0;
    let sellPoints = 0;

    if (!rsiResult || !rsiResult.rsi) return { buyPoints, sellPoints };

    const rsi = rsiResult.rsi;

    // RSI < 30: Strong oversold (2 buy points)
    if (rsi < 30) {
      buyPoints += 2;
    }
    // RSI 30-40: Mild oversold (1 buy point)
    else if (rsi < 40) {
      buyPoints += 1;
    }
    // RSI > 70: Strong overbought (2 sell points)
    else if (rsi > 70) {
      sellPoints += 2;
    }
    // RSI 60-70: Mild overbought (1 sell point)
    else if (rsi > 60) {
      sellPoints += 1;
    }

    return { buyPoints, sellPoints };
  }

  /**
   * Get MACD signal points for the algorithm
   */
  getMACDSignalPoints(macdResult) {
    let buyPoints = 0;
    let sellPoints = 0;

    if (!macdResult || macdResult.signal === 'insufficient_data') return { buyPoints, sellPoints };

    const { macd, signal, histogram } = macdResult;

    // MACD line crosses above signal line with positive histogram (2 buy points)
    if (macd > signal && histogram > 0) {
      buyPoints += 2;
    }
    // MACD line crosses below signal line with negative histogram (2 sell points)
    else if (macd < signal && histogram < 0) {
      sellPoints += 2;
    }

    return { buyPoints, sellPoints };
  }

  /**
   * Get Bollinger Bands signal points for the algorithm
   */
  getBollingerBandsSignalPoints(bbResult) {
    let buyPoints = 0;
    let sellPoints = 0;

    if (!bbResult || bbResult.signal === 'insufficient_data') return { buyPoints, sellPoints };

    const { percentB } = bbResult;

    // Price below lower band (1 buy point)
    if (percentB < 0) {
      buyPoints += 1;
    }
    // Price above upper band (1 sell point)
    else if (percentB > 1) {
      sellPoints += 1;
    }

    return { buyPoints, sellPoints };
  }

  /**
   * Get EMA signal points for the algorithm
   */
  getEMASignalPoints(emaResult) {
    let buyPoints = 0;
    let sellPoints = 0;

    if (!emaResult || emaResult.signal === 'insufficient_data') return { buyPoints, sellPoints };

    // Price above EMA (1 buy point)
    if (emaResult.price_vs_ema > 0) {
      buyPoints += 1;
    }
    // Price below EMA (1 sell point)
    else if (emaResult.price_vs_ema < 0) {
      sellPoints += 1;
    }

    return { buyPoints, sellPoints };
  }

  /**
   * Get SMA signal points for the algorithm
   */
  getSMASignalPoints(smaResult) {
    let buyPoints = 0;
    let sellPoints = 0;

    if (!smaResult || smaResult.signal === 'insufficient_data') return { buyPoints, sellPoints };

    // Price above SMA (1 buy point)
    if (smaResult.price_vs_sma > 0) {
      buyPoints += 1;
    }
    // Price below SMA (1 sell point)
    else if (smaResult.price_vs_sma < 0) {
      sellPoints += 1;
    }

    return { buyPoints, sellPoints };
  }

  /**
   * Get Stochastic signal points for the algorithm
   */
  getStochasticSignalPoints(stochResult) {
    let buyPoints = 0;
    let sellPoints = 0;

    if (!stochResult || stochResult.signal === 'insufficient_data') return { buyPoints, sellPoints };

    const { k } = stochResult;

    // Stochastic < 20: Oversold (1 buy point)
    if (k < 20) {
      buyPoints += 1;
    }
    // Stochastic > 80: Overbought (1 sell point)
    else if (k > 80) {
      sellPoints += 1;
    }

    return { buyPoints, sellPoints };
  }

  /**
   * Get Volume signal points for the algorithm
   */
  getVolumeSignalPoints(volumeResult) {
    let buyPoints = 0;
    let sellPoints = 0;

    if (!volumeResult || volumeResult.volume_trend === 'insufficient_data') return { buyPoints, sellPoints };

    const { volume_trend, price_direction } = volumeResult;

    // Volume increasing with buy points from other indicators
    if (volume_trend === 'increasing' && price_direction === 'up') {
      buyPoints += 1;
    }
    // Volume increasing with sell points from other indicators
    else if (volume_trend === 'increasing' && price_direction === 'down') {
      sellPoints += 1;
    }

    return { buyPoints, sellPoints };
  }

  /**
   * Validate analysis result
   */
  validateAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') {
      return { valid: false, error: 'Invalid analysis result' };
    }

    const required = ['asset', 'market_data', 'indicators', 'signal'];
    for (const field of required) {
      if (!analysis[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Allow 0 confidence (it's valid, just means low/no confidence)
    if (typeof analysis.signal.confidence !== 'number' || analysis.signal.confidence < 0 || analysis.signal.confidence > 100) {
      return { valid: false, error: 'Invalid confidence score' };
    }

    return { valid: true };
  }

  /**
   * Get indicator health check
   */
  getHealth() {
    const health = {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      indicators: {}
    };

    for (const [name, indicator] of Object.entries(this.indicators)) {
      try {
        indicator.validate();
        health.indicators[name] = 'healthy';
      } catch (error) {
        health.indicators[name] = 'error';
        health.status = 'unhealthy';
      }
    }

    return health;
  }

  /**
   * Get supported indicators
   */
  getSupportedIndicators() {
    return Object.keys(this.indicators).map(name => ({
      name,
      metadata: this.indicators[name].getMetadata()
    }));
  }

  /**
   * Update indicator settings
   */
  updateIndicatorSettings(indicatorName, settings) {
    if (!this.indicators[indicatorName]) {
      throw new Error(`Indicator ${indicatorName} not found`);
    }

    // Reinitialize indicator with new settings
    const IndicatorClass = this.indicators[indicatorName].constructor;
    this.indicators[indicatorName] = new IndicatorClass(...Object.values(settings));

    this.logger.info('Indicator settings updated', { indicatorName, settings });
  }

  /**
   * Reset all indicators to default settings
   */
  resetToDefaults() {
    this.initializeIndicators();
    this.logger.info('All indicators reset to default settings');
  }
}

module.exports = TechnicalIndicators;