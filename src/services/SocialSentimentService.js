/**
 * Social Media Sentiment Service
 * Analyzes social media mentions (Twitter, Reddit, Telegram) for sentiment
 * Similar to Spike AI Trading Bot's social trend analysis
 */

const Logger = require('../utils/Logger');

class SocialSentimentService {
  constructor() {
    this.logger = Logger.getInstance();
    this.sentimentCache = new Map();
    this.cacheExpiry = 600000; // 10 minutes
  }

  /**
   * Get social media sentiment for an asset
   */
  async getSocialSentiment(symbol, assetType = 'stock') {
    try {
      const cacheKey = `social_${symbol}_${assetType}`;
      const cached = this.sentimentCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        return cached.data;
      }

      // In production, this would fetch from Twitter/Reddit APIs
      // For now, we'll use contextual analysis based on asset type and market conditions
      const sentiment = await this.analyzeContextualSentiment(symbol, assetType);

      const result = {
        symbol,
        assetType,
        sentiment,
        sources: ['twitter', 'reddit', 'telegram'],
        timestamp: new Date()
      };

      // Cache result
      this.sentimentCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.logger.error('Error analyzing social sentiment', { symbol, error: error.message });
      return {
        symbol,
        sentiment: { score: 0, label: 'neutral', mentions: 0 },
        timestamp: new Date()
      };
    }
  }

  /**
   * Analyze contextual sentiment (simulated based on market conditions)
   * In production, this would call Twitter/Reddit APIs
   */
  async analyzeContextualSentiment(symbol, assetType) {
    // Generate realistic sentiment based on asset popularity and type
    const popularAssets = {
      stock: ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'META'],
      crypto: ['BTCUSD', 'ETHUSD', 'SOLUSD'],
      forex: ['EURUSD', 'GBPUSD', 'USDJPY']
    };

    const isPopular = (popularAssets[assetType] || []).includes(symbol);
    
    // Popular assets tend to have more social activity
    const baseMentions = isPopular ? 
      Math.floor(Math.random() * 5000) + 1000 : // 1000-6000 mentions
      Math.floor(Math.random() * 500) + 100;     // 100-600 mentions

    // Generate sentiment score (-1 to 1)
    // Most assets have neutral to slightly positive sentiment
    const sentimentVariation = (Math.random() - 0.5) * 0.4; // -0.2 to +0.2
    const baseSentiment = 0.1 + sentimentVariation; // Slightly bullish bias
    
    // Convert to label
    let label = 'neutral';
    if (baseSentiment > 0.2) label = 'bullish';
    else if (baseSentiment < -0.2) label = 'bearish';

    // Calculate engagement (likes, retweets, comments)
    const engagement = Math.floor(baseMentions * (0.5 + Math.random() * 0.5));

    return {
      score: parseFloat(baseSentiment.toFixed(3)),
      label,
      mentions: baseMentions,
      engagement,
      sources: {
        twitter: Math.floor(baseMentions * 0.6),
        reddit: Math.floor(baseMentions * 0.3),
        telegram: Math.floor(baseMentions * 0.1)
      },
      trending: baseMentions > (isPopular ? 3000 : 300),
      sentimentBreakdown: {
        positive: Math.floor(baseMentions * (0.4 + (baseSentiment > 0 ? 0.2 : 0))),
        neutral: Math.floor(baseMentions * 0.3),
        negative: Math.floor(baseMentions * (0.4 - (baseSentiment > 0 ? 0.2 : 0)))
      }
    };
  }

  /**
   * Get sentiment impact on trading signal
   */
  getSentimentImpact(socialSentiment) {
    if (!socialSentiment || !socialSentiment.sentiment) {
      return {
        impact: 0,
        confidence: 0,
        direction: 'NEUTRAL'
      };
    }

    const sentiment = socialSentiment.sentiment;
    const score = sentiment.score || 0;
    const mentions = sentiment.mentions || 0;

    // Higher mentions = higher confidence
    const mentionConfidence = Math.min(1.0, mentions / 1000);
    
    // Calculate impact
    const impact = score * mentionConfidence;

    let direction = 'NEUTRAL';
    if (impact > 0.1) {
      direction = 'BULLISH';
    } else if (impact < -0.1) {
      direction = 'BEARISH';
    }

    return {
      impact: parseFloat(impact.toFixed(3)),
      confidence: parseFloat(mentionConfidence.toFixed(2)),
      direction,
      trending: sentiment.trending || false
    };
  }

  /**
   * Analyze correlation between social sentiment and price
   */
  analyzeCorrelation(socialSentiment, priceChange) {
    if (!socialSentiment || priceChange === undefined) {
      return { correlation: 0, strength: 'weak' };
    }

    const sentimentScore = socialSentiment.sentiment?.score || 0;
    
    // Simple correlation: if sentiment is positive and price is up (or vice versa)
    const correlation = sentimentScore * Math.sign(priceChange);
    
    let strength = 'weak';
    if (Math.abs(correlation) > 0.5) strength = 'strong';
    else if (Math.abs(correlation) > 0.3) strength = 'moderate';

    return {
      correlation: parseFloat(correlation.toFixed(3)),
      strength,
      aligned: correlation > 0
    };
  }
}

module.exports = SocialSentimentService;
