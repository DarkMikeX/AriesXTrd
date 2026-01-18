/**
 * Performance Service
 * Comprehensive trading performance tracking and analytics
 */

const Logger = require('../utils/Logger');
const Formatter = require('../utils/Formatter');
const Calculator = require('../utils/Calculator');

class PerformanceService {
  constructor(database = null) {
    this.database = database;
    this.logger = Logger.getInstance();
    this.formatter = new Formatter();
    this.isInitialized = false;
  }

  /**
   * Initialize the performance service
   */
  async initialize() {
    try {
      this.isInitialized = true;
      this.logger.info('✅ Performance service initialized');

    } catch (error) {
      this.logger.error('Failed to initialize performance service', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate and update user performance statistics
   */
  async updateUserPerformance(userId, periodType = 'daily') {
    try {
      if (!this.database) return null;

      const now = new Date();
      let periodStart, periodEnd;

      // Calculate period boundaries
      switch (periodType) {
        case 'daily':
          periodStart = new Date(now);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 1);
          break;

        case 'weekly':
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - now.getDay());
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 7);
          break;

        case 'monthly':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;

        case 'yearly':
          periodStart = new Date(now.getFullYear(), 0, 1);
          periodEnd = new Date(now.getFullYear() + 1, 0, 1);
          break;

        default:
          // Custom period - last 30 days
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - 30);
          periodEnd = now;
      }

      // Get trades for the period
      const trades = await this.getTradesForPeriod(userId, periodStart, periodEnd);

      if (trades.length === 0) {
        return this.createEmptyPerformance(userId, periodType, periodStart, periodEnd);
      }

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(trades, periodType, periodStart, periodEnd);

      // Save to database
      await this.savePerformanceToDatabase(userId, performance);

      this.logger.info('User performance updated', {
        userId,
        periodType,
        tradesCount: trades.length,
        winRate: performance.win_rate,
        totalProfit: performance.total_profit_loss
      });

      return performance;

    } catch (error) {
      this.logger.error('Failed to update user performance', { userId, periodType, error: error.message });
      throw error;
    }
  }

  /**
   * Get trades for a specific period
   */
  async getTradesForPeriod(userId, startDate, endDate) {
    try {
      const Trade = this.database.getModel('Trade');
      const trades = await Trade.findAll({
        where: {
          user_id: userId,
          entry_time: {
            [this.database.getSequelize().Op.gte]: startDate,
            [this.database.getSequelize().Op.lt]: endDate
          },
          status: 'CLOSED'
        },
        order: [['entry_time', 'ASC']]
      });

      return trades.map(trade => trade.toJSON());

    } catch (error) {
      this.logger.error('Failed to get trades for period', { userId, startDate, endDate, error: error.message });
      return [];
    }
  }

  /**
   * Calculate comprehensive performance metrics
   */
  calculatePerformanceMetrics(trades, periodType, periodStart, periodEnd) {
    // Basic trade statistics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.result === 'WIN').length;
    const losingTrades = trades.filter(t => t.result === 'LOSS').length;
    const drawTrades = trades.filter(t => t.result === 'DRAW').length;

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Financial metrics
    const totalInvested = trades.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalProfitLoss = trades.reduce((sum, t) => sum + parseFloat(t.profit_loss || 0), 0);
    const grossProfit = trades
      .filter(t => t.result === 'WIN')
      .reduce((sum, t) => sum + parseFloat(t.profit_loss), 0);
    const grossLoss = Math.abs(trades
      .filter(t => t.result === 'LOSS')
      .reduce((sum, t) => sum + parseFloat(t.profit_loss), 0));

    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
    const averageWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const averageTrade = totalTrades > 0 ? totalProfitLoss / totalTrades : 0;

    // Risk metrics
    const returns = trades.map(t => parseFloat(t.profit_loss) / parseFloat(t.amount));
    const maxDrawdown = Calculator.calculateMaxDrawdown(trades.map(t => t.profit_loss));
    const sharpeRatio = Calculator.calculateSharpeRatio(returns);

    // Find best/worst trades
    const sortedTrades = [...trades].sort((a, b) => parseFloat(b.profit_loss) - parseFloat(a.profit_loss));
    const largestWin = sortedTrades.length > 0 ? parseFloat(sortedTrades[0].profit_loss) : 0;
    const largestLoss = sortedTrades.length > 0 ? parseFloat(sortedTrades[sortedTrades.length - 1].profit_loss) : 0;

    // Asset performance
    const assetPerformance = this.calculateAssetPerformance(trades);

    // Time-based metrics
    const bestDay = this.findBestDay(trades);
    const worstDay = this.findWorstDay(trades);

    // Consecutive statistics
    const consecutiveStats = this.calculateConsecutiveStats(trades);

    return {
      user_id: trades[0]?.user_id,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      total_trades: totalTrades,
      winning_trades: winningTrades,
      losing_trades: losingTrades,
      draw_trades: drawTrades,
      total_invested: parseFloat(totalInvested.toFixed(2)),
      total_profit_loss: parseFloat(totalProfitLoss.toFixed(2)),
      net_profit: parseFloat(totalProfitLoss.toFixed(2)),
      gross_profit: parseFloat(grossProfit.toFixed(2)),
      gross_loss: parseFloat(grossLoss.toFixed(2)),
      win_rate: parseFloat(winRate.toFixed(2)),
      profit_factor: parseFloat(profitFactor.toFixed(4)),
      average_win: parseFloat(averageWin.toFixed(2)),
      average_loss: parseFloat(averageLoss.toFixed(2)),
      average_trade: parseFloat(averageTrade.toFixed(2)),
      largest_win: largestWin,
      largest_loss: largestLoss,
      max_drawdown: maxDrawdown.maxDrawdown,
      max_drawdown_percent: maxDrawdown.maxDrawdownPercent,
      sharpe_ratio: sharpeRatio ? parseFloat(sharpeRatio.toFixed(4)) : null,
      asset_performance: assetPerformance,
      best_performing_asset: assetPerformance.length > 0 ?
        assetPerformance.sort((a, b) => parseFloat(b.avg_profit) - parseFloat(a.avg_profit))[0]?.symbol : null,
      worst_performing_asset: assetPerformance.length > 0 ?
        assetPerformance.sort((a, b) => parseFloat(a.avg_profit) - parseFloat(b.avg_profit))[0]?.symbol : null,
      best_day: bestDay?.date,
      best_day_profit: bestDay?.profit || 0,
      worst_day: worstDay?.date,
      worst_day_loss: worstDay?.loss || 0,
      max_consecutive_wins: consecutiveStats.maxWins,
      max_consecutive_losses: consecutiveStats.maxLosses,
      current_win_streak: consecutiveStats.currentWins,
      current_loss_streak: consecutiveStats.currentLosses,
      average_trades_per_day: this.calculateAverageTradesPerDay(trades, periodStart, periodEnd),
      most_active_hour: this.findMostActiveHour(trades),
      last_updated: new Date()
    };
  }

  /**
   * Calculate asset-specific performance
   */
  calculateAssetPerformance(trades) {
    const assetStats = {};

    trades.forEach(trade => {
      const symbol = trade.asset_symbol;
      if (!assetStats[symbol]) {
        assetStats[symbol] = {
          symbol,
          total_trades: 0,
          wins: 0,
          total_profit: 0,
          total_invested: 0
        };
      }

      assetStats[symbol].total_trades++;
      assetStats[symbol].total_invested += parseFloat(trade.amount);
      assetStats[symbol].total_profit += parseFloat(trade.profit_loss || 0);

      if (trade.result === 'WIN') {
        assetStats[symbol].wins++;
      }
    });

    return Object.values(assetStats).map(stats => ({
      symbol: stats.symbol,
      total_trades: stats.total_trades,
      win_rate: stats.total_trades > 0 ? ((stats.wins / stats.total_trades) * 100).toFixed(2) : 0,
      avg_profit: stats.total_trades > 0 ? (stats.total_profit / stats.total_trades).toFixed(2) : 0,
      total_profit: stats.total_profit.toFixed(2),
      total_invested: stats.total_invested.toFixed(2)
    }));
  }

  /**
   * Find best performing day
   */
  findBestDay(trades) {
    const dailyProfits = {};

    trades.forEach(trade => {
      const date = trade.entry_time.toISOString().split('T')[0];
      if (!dailyProfits[date]) {
        dailyProfits[date] = 0;
      }
      dailyProfits[date] += parseFloat(trade.profit_loss || 0);
    });

    let bestDay = null;
    let maxProfit = -Infinity;

    Object.entries(dailyProfits).forEach(([date, profit]) => {
      if (profit > maxProfit) {
        maxProfit = profit;
        bestDay = { date, profit };
      }
    });

    return bestDay;
  }

  /**
   * Find worst performing day
   */
  findWorstDay(trades) {
    const dailyProfits = {};

    trades.forEach(trade => {
      const date = trade.entry_time.toISOString().split('T')[0];
      if (!dailyProfits[date]) {
        dailyProfits[date] = 0;
      }
      dailyProfits[date] += parseFloat(trade.profit_loss || 0);
    });

    let worstDay = null;
    let minProfit = Infinity;

    Object.entries(dailyProfits).forEach(([date, profit]) => {
      if (profit < minProfit) {
        minProfit = profit;
        worstDay = { date, loss: profit };
      }
    });

    return worstDay;
  }

  /**
   * Calculate consecutive win/loss streaks
   */
  calculateConsecutiveStats(trades) {
    if (trades.length === 0) {
      return { maxWins: 0, maxLosses: 0, currentWins: 0, currentLosses: 0 };
    }

    let maxWins = 0, maxLosses = 0;
    let currentWins = 0, currentLosses = 0;
    let tempWins = 0, tempLosses = 0;

    // Sort trades by entry time
    const sortedTrades = [...trades].sort((a, b) => new Date(a.entry_time) - new Date(b.entry_time));

    sortedTrades.forEach(trade => {
      if (trade.result === 'WIN') {
        tempWins++;
        tempLosses = 0;
        maxWins = Math.max(maxWins, tempWins);
      } else if (trade.result === 'LOSS') {
        tempLosses++;
        tempWins = 0;
        maxLosses = Math.max(maxLosses, tempLosses);
      }
    });

    // Current streaks (from the end)
    for (let i = sortedTrades.length - 1; i >= 0; i--) {
      const trade = sortedTrades[i];
      if (trade.result === 'WIN') {
        currentWins++;
        currentLosses = 0;
      } else if (trade.result === 'LOSS') {
        currentLosses++;
        currentWins = 0;
      } else {
        break; // Stop at first non-win/loss
      }
    }

    return {
      maxWins,
      maxLosses,
      currentWins,
      currentLosses
    };
  }

  /**
   * Calculate average trades per day
   */
  calculateAverageTradesPerDay(trades, startDate, endDate) {
    const daysDiff = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    return parseFloat((trades.length / daysDiff).toFixed(2));
  }

  /**
   * Find most active trading hour
   */
  findMostActiveHour(trades) {
    const hourCounts = {};

    trades.forEach(trade => {
      const hour = new Date(trade.entry_time).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let mostActiveHour = null;
    let maxTrades = 0;

    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxTrades) {
        maxTrades = count;
        mostActiveHour = parseInt(hour);
      }
    });

    return mostActiveHour;
  }

  /**
   * Create empty performance record
   */
  createEmptyPerformance(userId, periodType, periodStart, periodEnd) {
    return {
      user_id: userId,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      draw_trades: 0,
      total_invested: 0,
      total_profit_loss: 0,
      net_profit: 0,
      gross_profit: 0,
      gross_loss: 0,
      win_rate: 0,
      profit_factor: 0,
      average_win: 0,
      average_loss: 0,
      average_trade: 0,
      largest_win: 0,
      largest_loss: 0,
      max_drawdown: 0,
      max_drawdown_percent: 0,
      sharpe_ratio: null,
      asset_performance: [],
      last_updated: new Date()
    };
  }

  /**
   * Save performance to database
   */
  async savePerformanceToDatabase(userId, performance) {
    try {
      const Performance = this.database.getModel('Performance');

      await Performance.upsert(performance, {
        where: {
          user_id: userId,
          period_type: performance.period_type,
          period_start: performance.period_start
        }
      });

    } catch (error) {
      this.logger.error('Failed to save performance to database', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user performance summary
   */
  async getUserPerformanceSummary(userId, includeHistorical = false) {
    try {
      if (!this.database) return null;

      // Update current performance data
      await this.updateUserPerformance(userId, 'daily');
      await this.updateUserPerformance(userId, 'weekly');
      await this.updateUserPerformance(userId, 'monthly');

      const Performance = this.database.getModel('Performance');

      const performances = await Performance.findAll({
        where: { user_id: userId },
        order: [['period_start', 'DESC']]
      });

      const summary = {
        user_id: userId,
        last_updated: new Date(),
        periods: {}
      };

      performances.forEach(perf => {
        summary.periods[perf.period_type] = {
          total_trades: perf.total_trades,
          win_rate: perf.win_rate,
          total_profit: perf.total_profit_loss,
          profit_factor: perf.profit_factor,
          max_drawdown: perf.max_drawdown_percent,
          sharpe_ratio: perf.sharpe_ratio,
          average_trade: perf.average_trade,
          best_asset: perf.best_performing_asset,
          period: {
            start: perf.period_start,
            end: perf.period_end
          }
        };
      });

      if (includeHistorical) {
        summary.historical = await this.getHistoricalPerformance(userId);
      }

      return summary;

    } catch (error) {
      this.logger.error('Failed to get user performance summary', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get historical performance data
   */
  async getHistoricalPerformance(userId, days = 90) {
    try {
      const Performance = this.database.getModel('Performance');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const performances = await Performance.findAll({
        where: {
          user_id: userId,
          period_type: 'daily',
          period_start: { [this.database.getSequelize().Op.gte]: startDate }
        },
        order: [['period_start', 'ASC']]
      });

      return performances.map(perf => ({
        date: perf.period_start,
        trades: perf.total_trades,
        profit: perf.total_profit_loss,
        win_rate: perf.win_rate,
        drawdown: perf.max_drawdown_percent
      }));

    } catch (error) {
      this.logger.error('Failed to get historical performance', { userId, error: error.message });
      return [];
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(userId, format = 'text') {
    try {
      const summary = await this.getUserPerformanceSummary(userId, true);

      if (format === 'json') {
        return summary;
      }

      // Generate text report
      let report = `📊 TRADING PERFORMANCE REPORT\n`;
      report += `User ID: ${userId}\n`;
      report += `Generated: ${new Date().toLocaleString()}\n\n`;

      ['daily', 'weekly', 'monthly'].forEach(period => {
        const perf = summary.periods[period];
        if (perf) {
          report += `${period.toUpperCase()} PERFORMANCE:\n`;
          report += `• Total Trades: ${perf.total_trades}\n`;
          report += `• Win Rate: ${perf.win_rate}%\n`;
          report += `• Total Profit: ${this.formatter.formatCurrency(perf.total_profit)}\n`;
          report += `• Profit Factor: ${perf.profit_factor?.toFixed(2) || 'N/A'}\n`;
          report += `• Average Trade: ${this.formatter.formatCurrency(perf.average_trade)}\n`;
          report += `• Max Drawdown: ${perf.max_drawdown?.toFixed(2) || 0}%\n`;
          report += `• Sharpe Ratio: ${perf.sharpe_ratio?.toFixed(2) || 'N/A'}\n\n`;
        }
      });

      return report;

    } catch (error) {
      this.logger.error('Failed to generate performance report', { userId, format, error: error.message });
      throw error;
    }
  }

  /**
   * Get leaderboard (top performers)
   */
  async getLeaderboard(periodType = 'monthly', metric = 'win_rate', limit = 10) {
    try {
      const Performance = this.database.getModel('Performance');
      const User = this.database.getModel('User');

      const orderBy = metric === 'win_rate' ? 'win_rate' :
                     metric === 'profit' ? 'total_profit_loss' :
                     metric === 'trades' ? 'total_trades' : 'win_rate';

      const performers = await Performance.findAll({
        where: {
          period_type: periodType,
          total_trades: { [this.database.getSequelize().Op.gte]: 5 } // Minimum 5 trades
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['username', 'first_name', 'last_name']
        }],
        limit,
        order: [[orderBy, 'DESC']]
      });

      return performers.map((perf, index) => ({
        rank: index + 1,
        user_id: perf.user_id,
        username: perf.user.username || `${perf.user.first_name} ${perf.user.last_name}`,
        total_trades: perf.total_trades,
        win_rate: perf.win_rate,
        total_profit: perf.total_profit_loss,
        profit_factor: perf.profit_factor,
        average_trade: perf.average_trade,
        max_drawdown: perf.max_drawdown_percent,
        period: periodType
      }));

    } catch (error) {
      this.logger.error('Failed to get leaderboard', { periodType, metric, limit, error: error.message });
      throw error;
    }
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      database_available: !!this.database
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info('✅ Performance service cleaned up');
  }
}

module.exports = PerformanceService;