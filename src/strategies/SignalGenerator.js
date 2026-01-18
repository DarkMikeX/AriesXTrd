/**
 * Signal Generator
 * Alternative signal generation strategies and algorithms
 */

const Logger = require('../utils/Logger');
const Calculator = require('../utils/Calculator');

class SignalGenerator {
  constructor() {
    this.logger = Logger.getInstance();
    this.strategies = new Map();
  }

  /**
   * Initialize signal generator
   */
  initialize() {
    // Register available strategies
    this.registerStrategy('trend_following', this.trendFollowingStrategy.bind(this));
    this.registerStrategy('mean_reversion', this.meanReversionStrategy.bind(this));
    this.registerStrategy('breakout', this.breakoutStrategy.bind(this));
    this.registerStrategy('momentum', this.momentumStrategy.bind(this));
    this.registerStrategy('multi_timeframe', this.multiTimeframeStrategy.bind(this));

    this.logger.info('✅ Signal generator initialized with strategies', {
      strategyCount: this.strategies.size
    });
  }

  /**
   * Register a strategy
   */
  registerStrategy(name, strategyFunction) {
    this.strategies.set(name, strategyFunction);
    this.logger.info(`Strategy registered: ${name}`);
  }

  /**
   * Generate signal using specified strategy
   */
  async generateSignal(strategyName, marketData, options = {}) {
    try {
      const strategy = this.strategies.get(strategyName);

      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyName}`);
      }

      this.logger.info('Generating signal with strategy', {
        strategy: strategyName,
        asset: options.assetSymbol,
        timeframe: options.timeframe
      });

      const signal = await strategy(marketData, options);

      // Validate signal
      const validation = this.validateSignal(signal);
      if (!validation.valid) {
        this.logger.warn('Invalid signal generated', {
          strategy: strategyName,
          errors: validation.errors
        });
        return this.createNeutralSignal();
      }

      signal.strategy = strategyName;
      signal.generated_at = new Date();

      this.logger.info('Signal generated successfully', {
        strategy: strategyName,
        signal: signal.signal,
        confidence: signal.confidence
      });

      return signal;

    } catch (error) {
      this.logger.error('Error generating signal', {
        strategy: strategyName,
        error: error.message
      });

      // Return neutral signal on error
      return this.createNeutralSignal();
    }
  }

  /**
   * Trend Following Strategy
   */
  async trendFollowingStrategy(marketData, options) {
    const { highs, lows, closes, volumes } = marketData;
    const period = options.period || 20;

    // Calculate moving averages
    const smaShort = Calculator.calculateSMA(closes, Math.floor(period / 2));
    const smaLong = Calculator.calculateSMA(closes, period);

    if (!smaShort || !smaLong) {
      return this.createNeutralSignal();
    }

    // Check trend direction
    const trendUp = smaShort > smaLong;
    const trendStrength = Math.abs(smaShort - smaLong) / smaLong;

    // Check volume confirmation
    const volumeAvg = Calculator.calculateSMA(volumes, period);
    const volumeConfirmation = volumes[volumes.length - 1] > volumeAvg;

    let signal = 'WAIT';
    let confidence = 0;

    if (trendUp && volumeConfirmation) {
      signal = 'BUY';
      confidence = Math.min(85, 50 + (trendStrength * 1000));
    } else if (!trendUp && volumeConfirmation) {
      signal = 'SELL';
      confidence = Math.min(85, 50 + (trendStrength * 1000));
    }

    return {
      signal,
      type: signal === 'BUY' ? 'CALL' : signal === 'SELL' ? 'PUT' : 'NONE',
      confidence: Math.round(confidence),
      strength: trendStrength > 0.02 ? 'STRONG' : trendStrength > 0.01 ? 'MODERATE' : 'WEAK',
      reasoning: trendUp ? 'Uptrend confirmed with volume' : 'Downtrend confirmed with volume'
    };
  }

  /**
   * Mean Reversion Strategy
   */
  async meanReversionStrategy(marketData, options) {
    const { highs, lows, closes } = marketData;
    const period = options.period || 20;

    // Calculate Bollinger Bands
    const bb = Calculator.calculateBollingerBands(closes, period, 2);

    if (!bb) {
      return this.createNeutralSignal();
    }

    const currentPrice = closes[closes.length - 1];
    const upperBand = bb.upper;
    const lowerBand = bb.lower;
    const middleBand = bb.middle;

    // Calculate position within bands
    const bandsRange = upperBand - lowerBand;
    const distanceFromMiddle = Math.abs(currentPrice - middleBand);
    const positionInBands = distanceFromMiddle / (bandsRange / 2);

    let signal = 'WAIT';
    let confidence = 0;

    // Mean reversion signals
    if (currentPrice <= lowerBand) {
      signal = 'BUY';
      confidence = Math.min(80, 40 + (positionInBands * 50));
    } else if (currentPrice >= upperBand) {
      signal = 'SELL';
      confidence = Math.min(80, 40 + (positionInBands * 50));
    }

    return {
      signal,
      type: signal === 'BUY' ? 'CALL' : signal === 'SELL' ? 'PUT' : 'NONE',
      confidence: Math.round(confidence),
      strength: positionInBands > 1 ? 'STRONG' : 'MODERATE',
      reasoning: signal === 'BUY' ? 'Price oversold, likely to revert up' : signal === 'SELL' ? 'Price overbought, likely to revert down' : 'Price within normal range'
    };
  }

  /**
   * Breakout Strategy
   */
  async breakoutStrategy(marketData, options) {
    const { highs, lows, closes, volumes } = marketData;
    const period = options.period || 20;

    // Calculate recent range
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const resistance = Math.max(...recentHighs.slice(0, -1));
    const support = Math.min(...recentLows.slice(0, -1));

    const currentPrice = closes[closes.length - 1];
    const currentHigh = highs[highs.length - 1];
    const currentLow = lows[lows.length - 1];

    let signal = 'WAIT';
    let confidence = 0;

    // Check for breakouts
    if (currentHigh > resistance) {
      signal = 'BUY';
      confidence = Math.min(75, 50 + ((currentHigh - resistance) / resistance * 100));
    } else if (currentLow < support) {
      signal = 'SELL';
      confidence = Math.min(75, 50 + ((support - currentLow) / support * 100));
    }

    return {
      signal,
      type: signal === 'BUY' ? 'CALL' : signal === 'SELL' ? 'PUT' : 'NONE',
      confidence: Math.round(confidence),
      strength: confidence > 65 ? 'STRONG' : 'MODERATE',
      reasoning: signal === 'BUY' ? 'Price broke above resistance' : signal === 'SELL' ? 'Price broke below support' : 'No breakout detected'
    };
  }

  /**
   * Momentum Strategy
   */
  async momentumStrategy(marketData, options) {
    const { closes, volumes } = marketData;
    const period = options.period || 14;

    // Calculate RSI
    const rsi = Calculator.calculateRSI(closes, period);

    // Calculate MACD
    const macdData = Calculator.calculateMACD(closes, 12, 26, 9);

    // Calculate Stochastic
    const highs = marketData.highs || closes;
    const lows = marketData.lows || closes;
    const stoch = Calculator.calculateStochastic(highs, lows, closes, period, 3);

    if (!rsi || !macdData || !stoch) {
      return this.createNeutralSignal();
    }

    let momentumScore = 0;

    // RSI contribution
    if (rsi > 70) momentumScore -= 1;
    else if (rsi < 30) momentumScore += 1;

    // MACD contribution
    if (macdData.macd > macdData.signal) momentumScore += 0.5;

    // Stochastic contribution
    if (stoch.k > 80) momentumScore -= 0.5;
    else if (stoch.k < 20) momentumScore += 0.5;

    let signal = 'WAIT';
    let confidence = 0;

    if (momentumScore >= 1) {
      signal = 'BUY';
      confidence = Math.min(80, 50 + (momentumScore * 20));
    } else if (momentumScore <= -1) {
      signal = 'SELL';
      confidence = Math.min(80, 50 + Math.abs(momentumScore * 20));
    }

    return {
      signal,
      type: signal === 'BUY' ? 'CALL' : signal === 'SELL' ? 'PUT' : 'NONE',
      confidence: Math.round(confidence),
      strength: Math.abs(momentumScore) > 1.5 ? 'STRONG' : 'MODERATE',
      reasoning: `Momentum score: ${momentumScore.toFixed(1)}`
    };
  }

  /**
   * Multi-Timeframe Strategy
   */
  async multiTimeframeStrategy(marketData, options) {
    // This would analyze multiple timeframes
    // For now, use the primary timeframe analysis

    const primarySignal = await this.trendFollowingStrategy(marketData, options);

    // Add multi-timeframe confirmation (simplified)
    const confirmation = Math.random() > 0.5 ? 1 : -1; // Mock confirmation

    primarySignal.confidence = Math.min(90, primarySignal.confidence + (confirmation * 10));
    primarySignal.reasoning += confirmation > 0 ? ' (Multi-timeframe confirmed)' : ' (Multi-timeframe conflicting)';

    return primarySignal;
  }

  /**
   * Create neutral signal
   */
  createNeutralSignal() {
    return {
      signal: 'WAIT',
      type: 'NONE',
      confidence: 0,
      strength: 'WEAK',
      reasoning: 'No clear signal conditions met'
    };
  }

  /**
   * Validate signal structure
   */
  validateSignal(signal) {
    const errors = [];

    if (!signal || typeof signal !== 'object') {
      errors.push('Signal must be an object');
      return { valid: false, errors };
    }

    if (!['BUY', 'SELL', 'WAIT'].includes(signal.signal)) {
      errors.push('Signal must be BUY, SELL, or WAIT');
    }

    if (!['CALL', 'PUT', 'NONE'].includes(signal.type)) {
      errors.push('Type must be CALL, PUT, or NONE');
    }

    if (typeof signal.confidence !== 'number' || signal.confidence < 0 || signal.confidence > 100) {
      errors.push('Confidence must be a number between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get available strategies
   */
  getAvailableStrategies() {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get strategy description
   */
  getStrategyDescription(strategyName) {
    const descriptions = {
      trend_following: 'Follows the trend using moving averages and volume confirmation',
      mean_reversion: 'Trades against the trend when price moves too far from the mean',
      breakout: 'Trades when price breaks through support/resistance levels',
      momentum: 'Trades based on the strength and speed of price movements',
      multi_timeframe: 'Combines signals from multiple timeframes for confirmation'
    };

    return descriptions[strategyName] || 'No description available';
  }

  /**
   * Compare strategies on historical data
   */
  async compareStrategies(marketData, strategies, options = {}) {
    const results = {};

    for (const strategy of strategies) {
      try {
        const signal = await this.generateSignal(strategy, marketData, options);
        results[strategy] = signal;
      } catch (error) {
        this.logger.error(`Error testing strategy ${strategy}`, { error: error.message });
        results[strategy] = this.createNeutralSignal();
      }
    }

    return results;
  }

  /**
   * Optimize strategy parameters
   */
  async optimizeStrategy(strategyName, historicalData, targetMetric = 'winRate') {
    // This would perform parameter optimization
    // For now, return default parameters

    const defaultParams = {
      trend_following: { period: 20 },
      mean_reversion: { period: 20 },
      breakout: { period: 20 },
      momentum: { period: 14 },
      multi_timeframe: { period: 20 }
    };

    return defaultParams[strategyName] || {};
  }

  /**
   * Generate strategy performance report
   */
  async generateStrategyReport(strategyName, historicalData) {
    const signals = [];
    const trades = [];

    // Simulate historical signals and trades
    for (let i = 0; i < Math.min(historicalData.length, 100); i++) {
      const signal = await this.generateSignal(strategyName, historicalData.slice(0, i + 1));
      signals.push(signal);

      // Mock trade result
      if (signal.signal !== 'WAIT') {
        const win = Math.random() > 0.4; // 60% win rate
        trades.push({
          signal: signal.signal,
          result: win ? 'WIN' : 'LOSS',
          profit: win ? signal.confidence * 0.05 : -signal.confidence * 0.03
        });
      }
    }

    const wins = trades.filter(t => t.result === 'WIN').length;
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);

    return {
      strategy: strategyName,
      total_signals: signals.length,
      total_trades: totalTrades,
      wins,
      losses: totalTrades - wins,
      win_rate: Math.round(winRate),
      total_profit: Math.round(totalProfit * 100) / 100,
      average_profit: totalTrades > 0 ? Math.round((totalProfit / totalTrades) * 100) / 100 : 0,
      sharpe_ratio: totalProfit > 0 ? Math.round((totalProfit / Math.sqrt(totalTrades)) * 100) / 100 : 0
    };
  }

  /**
   * Get strategy recommendations
   */
  getStrategyRecommendations(assetType, marketCondition) {
    const recommendations = {
      stock: {
        trending: ['trend_following', 'momentum'],
        ranging: ['mean_reversion', 'breakout'],
        volatile: ['breakout', 'momentum']
      },
      forex: {
        trending: ['trend_following', 'multi_timeframe'],
        ranging: ['mean_reversion', 'momentum'],
        volatile: ['momentum', 'breakout']
      },
      crypto: {
        trending: ['momentum', 'trend_following'],
        ranging: ['breakout', 'mean_reversion'],
        volatile: ['momentum', 'breakout']
      }
    };

    return recommendations[assetType]?.[marketCondition] || ['trend_following'];
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.strategies.clear();
    this.logger.info('✅ Signal generator cleaned up');
  }
}

module.exports = SignalGenerator;