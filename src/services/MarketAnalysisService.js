/**
 * Market Analysis Service
 * Continuously analyzes all markets and tracks best performing pairs for recommendations
 */

const Logger = require('../utils/Logger');

class MarketAnalysisService {
  constructor(analysisService) {
    this.analysisService = analysisService;
    this.logger = Logger.getInstance();
    this.recommendations = {
      stock: { symbol: null, confidence: 0, lastUpdate: null },
      forex: { symbol: null, confidence: 0, lastUpdate: null },
      crypto: { symbol: null, confidence: 0, lastUpdate: null }
    };
    this.analysisInterval = null;
    this.analysisRunning = false;
  }

  /**
   * Initialize market analysis service
   */
  async initialize() {
    // Run initial analysis (non-blocking - don't fail initialization if analysis fails)
    this.analyzeAllMarkets().catch(error => {
      this.logger.warn('Initial market analysis failed (will retry)', { error: error.message });
    });
    
    // Start continuous analysis every 5 minutes
    this.startContinuousAnalysis(5 * 60 * 1000); // 5 minutes
    
    this.logger.info('✅ Market analysis service initialized');
  }

  /**
   * Get recommended pair for asset type
   */
  getRecommendedPair(assetType) {
    const normalizedType = assetType === 'stock' || assetType === 'stocks' ? 'stock' : 
                           assetType === 'forex' ? 'forex' : 
                           assetType === 'crypto' ? 'crypto' : assetType;
    
    return this.recommendations[normalizedType] || { symbol: null, confidence: 0 };
  }

  /**
   * Analyze all markets and update recommendations
   */
  async analyzeAllMarkets() {
    if (this.analysisRunning) {
      return; // Skip if already running
    }

    this.analysisRunning = true;

    try {
      // Analyze stocks
      const stockRecommendation = await this.findBestStock();
      if (stockRecommendation) {
        this.recommendations.stock = stockRecommendation;
      }

      // Analyze forex
      const forexRecommendation = await this.findBestForex();
      if (forexRecommendation) {
        this.recommendations.forex = forexRecommendation;
      }

      // Analyze crypto
      const cryptoRecommendation = await this.findBestCrypto();
      if (cryptoRecommendation) {
        this.recommendations.crypto = cryptoRecommendation;
      }

      this.logger.info('Market analysis completed', {
        stock: this.recommendations.stock.symbol,
        forex: this.recommendations.forex.symbol,
        crypto: this.recommendations.crypto.symbol
      });

    } catch (error) {
      this.logger.error('Market analysis error', { error: error.message });
    } finally {
      this.analysisRunning = false;
    }
  }

  /**
   * Find best stock based on signal confidence and trend
   */
  async findBestStock() {
    const stocks = ['AAPL', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'NVDA', 'META', 'NFLX', 'AMD', 'SPY'];
    let best = null;
    let bestConfidence = 0;

    // Sample a few stocks for performance (in production, would analyze all)
    const sampleSize = Math.min(5, stocks.length);
    const sampledStocks = stocks.slice(0, sampleSize);

    for (const symbol of sampledStocks) {
      try {
        const result = await this.analysisService.analyzeAsset(symbol, {
          assetType: 'stock',
          timeframe: '1H'
        });

        if (result && result.signal) {
          const signalType = result.signal.signal;
          // Skip WAIT signals - only show BUY/SELL recommendations
          if (signalType === 'WAIT' || signalType === 'NONE') {
            continue;
          }
          
          const confidence = result.signal.confidence || 0;
          // Prefer BUY signals with high confidence
          const isBuy = signalType.includes('BUY') || signalType.includes('CALL');
          const score = isBuy ? confidence * 1.2 : confidence; // Boost BUY signals

          if (score > bestConfidence) {
            bestConfidence = score;
            best = {
              symbol,
              confidence: Math.round(confidence),
              signal: signalType,
              score: Math.round(score),
              lastUpdate: new Date()
            };
          }
        }
      } catch (error) {
        // Continue with next stock if analysis fails
        this.logger.debug(`Error analyzing stock ${symbol}`, { error: error.message });
      }
    }

    return best;
  }

  /**
   * Find best forex pair based on signal confidence and trend
   */
  async findBestForex() {
    const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURJPY', 'GBPJPY'];
    let best = null;
    let bestConfidence = 0;

    // Sample a few pairs for performance
    const sampleSize = Math.min(5, pairs.length);
    const sampledPairs = pairs.slice(0, sampleSize);

    for (const symbol of sampledPairs) {
      try {
        const result = await this.analysisService.analyzeAsset(symbol, {
          assetType: 'forex',
          timeframe: '5m' // Forex typically uses shorter timeframes
        });

        if (result && result.signal) {
          const confidence = result.signal.confidence || 0;
          const isBuy = result.signal.signal.includes('BUY') || result.signal.signal.includes('CALL');
          const score = isBuy ? confidence * 1.2 : confidence;

          if (score > bestConfidence) {
            bestConfidence = score;
            best = {
              symbol,
              confidence: Math.round(confidence),
              signal: result.signal.signal,
              score: Math.round(score),
              lastUpdate: new Date()
            };
          }
        }
      } catch (error) {
        this.logger.debug(`Error analyzing forex ${symbol}`, { error: error.message });
      }
    }

    return best;
  }

  /**
   * Find best crypto based on signal confidence and trend
   */
  async findBestCrypto() {
    const cryptos = ['BTCUSD', 'ETHUSD', 'BNBUSD', 'ADAUSD', 'SOLUSD', 'DOTUSD', 'DOGEUSD', 'AVAXUSD', 'LTCUSD'];
    let best = null;
    let bestConfidence = 0;

    // Sample a few cryptos for performance
    const sampleSize = Math.min(5, cryptos.length);
    const sampledCryptos = cryptos.slice(0, sampleSize);

    for (const symbol of sampledCryptos) {
      try {
        const result = await this.analysisService.analyzeAsset(symbol, {
          assetType: 'crypto',
          timeframe: '4H' // Crypto typically uses longer timeframes
        });

        if (result && result.signal) {
          const confidence = result.signal.confidence || 0;
          const isBuy = result.signal.signal.includes('BUY') || result.signal.signal.includes('CALL');
          const score = isBuy ? confidence * 1.2 : confidence;

          if (score > bestConfidence) {
            bestConfidence = score;
            best = {
              symbol,
              confidence: Math.round(confidence),
              signal: result.signal.signal,
              score: Math.round(score),
              lastUpdate: new Date()
            };
          }
        }
      } catch (error) {
        this.logger.debug(`Error analyzing crypto ${symbol}`, { error: error.message });
      }
    }

    return best;
  }

  /**
   * Start continuous market analysis
   */
  startContinuousAnalysis(intervalMs = 5 * 60 * 1000) {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    this.analysisInterval = setInterval(() => {
      this.analyzeAllMarkets().catch(error => {
        this.logger.error('Continuous analysis error', { error: error.message });
      });
    }, intervalMs);

    this.logger.info('Continuous market analysis started', { intervalMinutes: intervalMs / 60000 });
  }

  /**
   * Stop continuous analysis
   */
  stopContinuousAnalysis() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
      this.logger.info('Continuous market analysis stopped');
    }
  }

  /**
   * Get all recommendations
   */
  getAllRecommendations() {
    return { ...this.recommendations };
  }
}

module.exports = MarketAnalysisService;
