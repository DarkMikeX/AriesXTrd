/**
 * Data Aggregation Service
 * Combines data from multiple sources (financial, news, social, technical)
 * Similar to Spike AI Trading Bot's multi-source data collection
 */

const Logger = require('../utils/Logger');

class DataAggregationService {
  constructor(analysisService, newsService, mlService, socialService) {
    this.analysisService = analysisService;
    this.newsService = newsService;
    this.mlService = mlService;
    this.socialService = socialService;
    this.logger = Logger.getInstance();
  }

  /**
   * Aggregate all data sources for comprehensive analysis
   */
  async aggregateDataForAsset(symbol, assetType, timeframe) {
    try {
      this.logger.info('Aggregating multi-source data', { symbol, assetType, timeframe });

      // 1. Financial data (from TradingView/Yahoo/Binance)
      const financialData = await this.getFinancialData(symbol, assetType, timeframe);

      // 2. Technical indicators (already calculated in financial data)
      const technicalData = financialData.indicators || {};

      // 3. News sentiment
      const newsData = await this.newsService.getNewsForAsset(symbol, assetType);

      // 4. Social media sentiment
      const socialData = this.socialService ? 
        await this.socialService.getSocialSentiment(symbol, assetType) : null;

      // 5. ML prediction
      const mlPrediction = this.mlService ? 
        await this.mlService.predictPriceMovement(symbol, assetType, financialData) : null;

      // 6. Economic indicators
      const economicData = this.newsService.analyzeEconomicIndicators(assetType);

      // 7. Market conditions
      const marketConditions = this.analyzeMarketConditions(financialData);

      // Combine all data
      const aggregatedData = {
        symbol,
        assetType,
        timeframe,
        timestamp: new Date(),
        
        // Financial data
        financial: {
          currentPrice: financialData.market_data?.current_price || 0,
          priceChange: financialData.market_data?.priceChange || 0,
          volume: financialData.market_data?.volume || 0,
          high: financialData.market_data?.high || 0,
          low: financialData.market_data?.low || 0,
          candles: financialData.market_data?.candles || []
        },

        // Technical indicators
        technical: technicalData,

        // News sentiment
        news: {
          sentiment: newsData.sentiment,
          impact: this.newsService.getNewsImpact(newsData),
          articleCount: newsData.articles?.length || 0
        },

        // Social media sentiment
        social: {
          sentiment: socialData.sentiment,
          impact: this.socialService.getSentimentImpact(socialData),
          mentions: socialData.sentiment?.mentions || 0,
          trending: socialData.sentiment?.trending || false
        },

        // ML prediction
        mlPrediction: {
          prediction: mlPrediction.prediction,
          confidence: mlPrediction.confidence,
          priceTarget: mlPrediction.priceTarget,
          expectedMove: mlPrediction.expectedMove,
          pattern: mlPrediction.pattern
        },

        // Economic indicators
        economic: economicData,

        // Market conditions
        marketConditions,

        // Combined signal strength (enhanced with ML and Social)
        combinedSignal: this.generateCombinedSignal(financialData, newsData, marketConditions, socialData, mlPrediction)
      };

      this.logger.info('Data aggregation completed', {
        symbol,
        sources: ['financial', 'technical', 'news', 'economic'],
        signalStrength: aggregatedData.combinedSignal.strength
      });

      return aggregatedData;

    } catch (error) {
      this.logger.error('Error aggregating data', { symbol, assetType, error: error.message });
      throw error;
    }
  }

  /**
   * Get financial data from analysis service
   */
  async getFinancialData(symbol, assetType, timeframe) {
    try {
      return await this.analysisService.analyzeAsset(symbol, {
        assetType,
        timeframe
      });
    } catch (error) {
      this.logger.error('Error fetching financial data', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Analyze current market conditions
   */
  analyzeMarketConditions(financialData) {
    const candles = financialData.market_data?.candles || [];
    const indicators = financialData.indicators || {};

    if (candles.length === 0) {
      return {
        trend: 'unknown',
        volatility: 'unknown',
        liquidity: 'unknown'
      };
    }

    // Calculate trend from recent candles
    const recentCloses = candles.slice(-10).map(c => c.close);
    const trend = this.calculateTrend(recentCloses);

    // Calculate volatility (ATR or price range)
    const volatility = this.calculateVolatility(candles);

    // Estimate liquidity from volume
    const volumes = candles.map(c => c.volume || 0);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const liquidity = avgVolume > 1000000 ? 'high' : avgVolume > 100000 ? 'medium' : 'low';

    return {
      trend,
      volatility,
      liquidity,
      priceRange: {
        high: Math.max(...recentCloses),
        low: Math.min(...recentCloses),
        current: recentCloses[recentCloses.length - 1]
      }
    };
  }

  /**
   * Calculate trend from price data
   */
  calculateTrend(prices) {
    if (prices.length < 2) return 'unknown';

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;

    if (change > 2) return 'strong_upward';
    if (change > 0.5) return 'upward';
    if (change < -2) return 'strong_downward';
    if (change < -0.5) return 'downward';
    return 'sideways';
  }

  /**
   * Calculate volatility
   */
  calculateVolatility(candles) {
    if (candles.length < 2) return 'unknown';

    const priceChanges = [];
    for (let i = 1; i < candles.length; i++) {
      const change = Math.abs((candles[i].close - candles[i-1].close) / candles[i-1].close);
      priceChanges.push(change);
    }

    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;

    if (avgChange > 0.05) return 'high'; // >5% average change
    if (avgChange > 0.02) return 'medium'; // 2-5%
    return 'low'; // <2%
  }

  /**
   * Generate combined signal from all data sources (Enhanced with ML and Social)
   */
  generateCombinedSignal(financialData, newsData, marketConditions, socialData, mlPrediction) {
    // Technical signal from financial data
    const technicalSignal = financialData.signal || { signal: 'WAIT', confidence: 0 };
    
    // News impact
    const newsImpact = this.newsService.getNewsImpact(newsData);

    // Social sentiment impact
    const socialImpact = socialData ? this.socialService.getSentimentImpact(socialData) : { impact: 0, direction: 'NEUTRAL' };

    // ML prediction
    const mlDirection = mlPrediction?.prediction || 'NEUTRAL';
    const mlConfidence = mlPrediction?.confidence || 0;

    // Combine signals with enhanced weights
    const weights = {
      technical: 0.40,  // 40% weight on technical analysis
      ml: 0.25,         // 25% weight on ML prediction
      news: 0.20,       // 20% weight on news sentiment
      social: 0.10,     // 10% weight on social sentiment
      market: 0.05      // 5% weight on market conditions
    };

    let combinedScore = 0;
    let combinedDirection = 'NEUTRAL';

    // Technical contribution
    if (technicalSignal.signal === 'BUY') {
      combinedScore += technicalSignal.confidence * weights.technical / 100;
      combinedDirection = 'BUY';
    } else if (technicalSignal.signal === 'SELL') {
      combinedScore -= technicalSignal.confidence * weights.technical / 100;
      combinedDirection = 'SELL';
    }

    // ML prediction contribution
    if (mlDirection === 'BULLISH') {
      combinedScore += (mlConfidence / 100) * weights.ml;
    } else if (mlDirection === 'BEARISH') {
      combinedScore -= (mlConfidence / 100) * weights.ml;
    }

    // News contribution
    if (newsImpact.direction === 'BUY') {
      combinedScore += newsImpact.impact * weights.news;
    } else if (newsImpact.direction === 'SELL') {
      combinedScore -= newsImpact.impact * weights.news;
    }

    // Social sentiment contribution
    if (socialImpact.direction === 'BULLISH') {
      combinedScore += socialImpact.impact * weights.social;
    } else if (socialImpact.direction === 'BEARISH') {
      combinedScore -= socialImpact.impact * weights.social;
    }

    // Market conditions contribution (trend-based)
    if (marketConditions.trend === 'strong_upward' || marketConditions.trend === 'upward') {
      combinedScore += 0.1 * weights.market;
    } else if (marketConditions.trend === 'strong_downward' || marketConditions.trend === 'downward') {
      combinedScore -= 0.1 * weights.market;
    }

    // Determine final signal
    let finalSignal = 'WAIT';
    let finalConfidence = 0;

    if (Math.abs(combinedScore) > 0.4) { // Threshold for action
      finalSignal = combinedScore > 0 ? 'BUY' : 'SELL';
      finalConfidence = Math.min(95, Math.abs(combinedScore) * 100);
    }

    return {
      signal: finalSignal,
      confidence: Math.round(finalConfidence),
      direction: combinedDirection,
      strength: finalConfidence > 75 ? 'STRONG' : finalConfidence > 50 ? 'MODERATE' : 'WEAK',
      breakdown: {
        technical: {
          signal: technicalSignal.signal,
          confidence: technicalSignal.confidence,
          weight: weights.technical
        },
        ml: {
          prediction: mlDirection,
          confidence: mlConfidence,
          weight: weights.ml
        },
        news: {
          direction: newsImpact.direction,
          impact: newsImpact.impact,
          weight: weights.news
        },
        social: {
          direction: socialImpact.direction,
          impact: socialImpact.impact,
          weight: weights.social
        },
        market: {
          trend: marketConditions.trend,
          weight: weights.market
        }
      }
    };
  }

  /**
   * Filter noise and highlight key events
   */
  filterNoise(data) {
    // Filter out low-confidence signals
    if (data.combinedSignal.confidence < 50) {
      return null;
    }

    // Highlight significant price movements
    const priceChange = Math.abs(data.financial.priceChange || 0);
    const significantMovement = priceChange > 0.02; // >2% change

    // Highlight strong news sentiment
    const strongNews = Math.abs(data.news.sentiment.score) > 0.3;

    return {
      ...data,
      highlights: {
        significantMovement,
        strongNews,
        keyEvent: significantMovement || strongNews
      }
    };
  }
}

module.exports = DataAggregationService;
