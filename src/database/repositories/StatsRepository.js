/**
 * Stats Repository
 * Data access layer for Performance statistics
 */

const Logger = require('../../utils/Logger');

class StatsRepository {
  constructor(database) {
    this.database = database;
    this.Performance = database.getModel('Performance');
    this.Trade = database.getModel('Trade');
    this.Signal = database.getModel('Signal');
    this.User = database.getModel('User');
    this.logger = Logger.getInstance();
  }

  /**
   * Create or update performance record
   */
  async upsertPerformance(userId, periodType, periodStart, periodEnd = null) {
    try {
      const [performance, created] = await this.Performance.findOrCreate({
        where: {
          user_id: userId,
          period_type: periodType,
          period_start: periodStart
        },
        defaults: {
          period_end: periodEnd,
          last_updated: new Date()
        }
      });

      if (!created) {
        performance.period_end = periodEnd;
        performance.last_updated = new Date();
        await performance.save();
      }

      return performance;
    } catch (error) {
      this.logger.error('Error upserting performance', { userId, periodType, periodStart, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate and update performance statistics
   */
  async updatePerformanceStats(userId, periodType, periodStart, periodEnd = null) {
    try {
      // Get trades for the period
      const whereClause = { user_id: userId };
      if (periodEnd) {
        whereClause.entry_time = {
          [this.database.getSequelize().Op.between]: [periodStart, periodEnd]
        };
      } else {
        whereClause.entry_time = {
          [this.database.getSequelize().Op.gte]: periodStart
        };
      }

      const trades = await this.Trade.findAll({
        where: whereClause,
        attributes: [
          'result',
          'profit_loss',
          'amount',
          'asset_symbol'
        ]
      });

      if (trades.length === 0) {
        return null;
      }

      // Calculate statistics
      let totalTrades = trades.length;
      let winningTrades = 0;
      let losingTrades = 0;
      let drawTrades = 0;
      let totalInvested = 0;
      let totalProfitLoss = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let largestWin = 0;
      let largestLoss = 0;

      const assetPerformance = {};

      trades.forEach(trade => {
        const profit = parseFloat(trade.profit_loss);
        const amount = parseFloat(trade.amount);

        totalInvested += amount;
        totalProfitLoss += profit;

        // Track asset performance
        if (!assetPerformance[trade.asset_symbol]) {
          assetPerformance[trade.asset_symbol] = {
            trades: 0,
            wins: 0,
            profit: 0
          };
        }
        assetPerformance[trade.asset_symbol].trades += 1;
        assetPerformance[trade.asset_symbol].profit += profit;

        if (trade.result === 'WIN') {
          winningTrades += 1;
          grossProfit += profit;
          largestWin = Math.max(largestWin, profit);
          assetPerformance[trade.asset_symbol].wins += 1;
        } else if (trade.result === 'LOSS') {
          losingTrades += 1;
          grossLoss += Math.abs(profit);
          largestLoss = Math.min(largestLoss, profit);
        } else if (trade.result === 'DRAW') {
          drawTrades += 1;
        }
      });

      // Calculate derived metrics
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
      const averageWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
      const averageLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
      const averageTrade = totalTrades > 0 ? totalProfitLoss / totalTrades : 0;

      // Find best and worst performing assets
      let bestAsset = null;
      let worstAsset = null;
      let bestAssetWinRate = 0;
      let worstAssetWinRate = 100;

      Object.entries(assetPerformance).forEach(([symbol, data]) => {
        const winRate = data.trades > 0 ? (data.wins / data.trades) * 100 : 0;

        if (winRate > bestAssetWinRate) {
          bestAssetWinRate = winRate;
          bestAsset = symbol;
        }

        if (winRate < worstAssetWinRate) {
          worstAssetWinRate = winRate;
          worstAsset = symbol;
        }
      });

      // Upsert performance record
      const [performance, created] = await this.Performance.upsert({
        user_id: userId,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        draw_trades: drawTrades,
        total_invested: totalInvested,
        total_profit_loss: totalProfitLoss,
        net_profit: totalProfitLoss,
        gross_profit: grossProfit,
        gross_loss: grossLoss,
        win_rate: winRate,
        profit_factor: profitFactor,
        average_win: averageWin,
        average_loss: averageLoss,
        average_trade: averageTrade,
        largest_win: largestWin,
        largest_loss: largestLoss,
        best_performing_asset: bestAsset,
        worst_performing_asset: worstAsset,
        asset_performance: assetPerformance,
        last_updated: new Date()
      });

      this.logger.info('Performance stats updated', {
        userId,
        periodType,
        totalTrades,
        winRate: winRate.toFixed(2) + '%',
        totalProfit: totalProfitLoss.toFixed(2)
      });

      return performance;
    } catch (error) {
      this.logger.error('Error updating performance stats', {
        userId,
        periodType,
        periodStart,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get performance statistics
   */
  async getPerformance(userId, periodType = 'all_time', limit = 1) {
    try {
      const performances = await this.Performance.findAll({
        where: {
          user_id: userId,
          period_type: periodType
        },
        limit,
        order: [['period_start', 'DESC']]
      });

      return performances.length > 0 ? performances[0] : null;
    } catch (error) {
      this.logger.error('Error getting performance', { userId, periodType, error: error.message });
      throw error;
    }
  }

  /**
   * Get performance summary for user
   */
  async getPerformanceSummary(userId) {
    try {
      const summaries = {};

      // Get different time periods
      const periods = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];

      for (const period of periods) {
        const performance = await this.getPerformance(userId, period);
        if (performance) {
          summaries[period] = performance.getSummary();
        }
      }

      return summaries;
    } catch (error) {
      this.logger.error('Error getting performance summary', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get top performers across all users
   */
  async getTopPerformers(periodType = 'monthly', metric = 'win_rate', limit = 10) {
    try {
      const orderBy = metric === 'win_rate' ? 'win_rate' :
                     metric === 'profit' ? 'total_profit_loss' :
                     metric === 'trades' ? 'total_trades' : 'win_rate';

      const performers = await this.Performance.findAll({
        where: {
          period_type: periodType,
          total_trades: { [this.database.getSequelize().Op.gte]: 5 } // Minimum 5 trades
        },
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['telegram_id', 'username']
          }
        ],
        limit,
        order: [[orderBy, 'DESC']]
      });

      return performers.map(p => ({
        user_id: p.user_id,
        username: p.user.telegram_id,
        display_name: p.user.username || `User ${p.user.telegram_id}`,
        total_trades: p.total_trades,
        win_rate: p.win_rate,
        total_profit: p.total_profit_loss,
        profit_factor: p.profit_factor,
        average_trade: p.average_trade,
        grade: p.getGrade()
      }));
    } catch (error) {
      this.logger.error('Error getting top performers', { periodType, metric, limit, error: error.message });
      throw error;
    }
  }

  /**
   * Get asset performance across users
   */
  async getAssetPerformanceGlobal(limit = 20) {
    try {
      // This would aggregate performance across all users for each asset
      // For now, return basic structure
      const assets = await this.database.query(`
        SELECT
          t.asset_symbol,
          t.asset_name,
          COUNT(*) as total_trades,
          SUM(CASE WHEN t.result = 'WIN' THEN 1 ELSE 0 END) as wins,
          AVG(t.profit_loss) as avg_profit,
          SUM(t.profit_loss) as total_profit
        FROM trades t
        WHERE t.status = 'CLOSED'
        GROUP BY t.asset_symbol, t.asset_name
        ORDER BY total_profit DESC
        LIMIT ?
      `, { replacements: [limit] });

      return assets.map(asset => ({
        symbol: asset.asset_symbol,
        name: asset.asset_name,
        total_trades: parseInt(asset.total_trades),
        wins: parseInt(asset.wins),
        win_rate: parseFloat(((parseInt(asset.wins) / parseInt(asset.total_trades)) * 100).toFixed(2)),
        avg_profit: parseFloat(asset.avg_profit).toFixed(2),
        total_profit: parseFloat(asset.total_profit).toFixed(2)
      }));
    } catch (error) {
      this.logger.error('Error getting global asset performance', { limit, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate Sharpe ratio for user
   */
  async calculateSharpeRatio(userId, periodType = 'monthly', riskFreeRate = 0.02) {
    try {
      const performance = await this.getPerformance(userId, periodType);
      if (!performance || performance.total_trades < 10) {
        return null; // Need minimum trades for meaningful calculation
      }

      // Get daily returns for the period
      const trades = await this.Trade.findAll({
        where: {
          user_id: userId,
          entry_time: {
            [this.database.getSequelize().Op.gte]: performance.period_start,
            ...(performance.period_end && {
              [this.database.getSequelize().Op.lte]: performance.period_end
            })
          }
        },
        attributes: ['entry_time', 'profit_loss', 'amount'],
        order: [['entry_time', 'ASC']]
      });

      if (trades.length < 10) return null;

      // Calculate daily returns
      const dailyReturns = [];
      const dailyProfits = {};

      trades.forEach(trade => {
        const date = trade.entry_time.toISOString().split('T')[0];
        if (!dailyProfits[date]) {
          dailyProfits[date] = 0;
        }
        dailyProfits[date] += parseFloat(trade.profit_loss);
      });

      Object.values(dailyProfits).forEach(profit => {
        dailyReturns.push(profit);
      });

      if (dailyReturns.length === 0) return null;

      // Calculate mean and standard deviation
      const mean = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / dailyReturns.length;
      const stdDev = Math.sqrt(variance);

      // Calculate Sharpe ratio
      const sharpeRatio = stdDev > 0 ? (mean - riskFreeRate) / stdDev : 0;

      // Update performance record
      performance.sharpe_ratio = sharpeRatio;
      await performance.save();

      return sharpeRatio;
    } catch (error) {
      this.logger.error('Error calculating Sharpe ratio', { userId, periodType, error: error.message });
      throw error;
    }
  }

  /**
   * Get performance comparison with market
   */
  async getMarketComparison(userId, periodType = 'monthly') {
    try {
      const userPerformance = await this.getPerformance(userId, periodType);
      if (!userPerformance) return null;

      // Get average performance across all users for the same period
      const marketStats = await this.Performance.findAll({
        where: {
          period_type: periodType,
          total_trades: { [this.database.getSequelize().Op.gte]: 3 }
        },
        attributes: [
          [this.database.getSequelize().fn('AVG', this.database.getSequelize().col('win_rate')), 'avg_win_rate'],
          [this.database.getSequelize().fn('AVG', this.database.getSequelize().col('total_profit_loss')), 'avg_profit'],
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'total_users']
        ]
      });

      if (marketStats.length === 0) return null;

      const market = marketStats[0].dataValues;

      return {
        user: {
          win_rate: userPerformance.win_rate,
          total_profit: userPerformance.total_profit_loss,
          total_trades: userPerformance.total_trades
        },
        market: {
          avg_win_rate: parseFloat(market.avg_win_rate).toFixed(2),
          avg_profit: parseFloat(market.avg_profit).toFixed(2),
          total_users: parseInt(market.total_users)
        },
        comparison: {
          win_rate_percentile: userPerformance.win_rate > parseFloat(market.avg_win_rate) ? 'above' : 'below',
          profit_percentile: userPerformance.total_profit_loss > parseFloat(market.avg_profit) ? 'above' : 'below'
        }
      };
    } catch (error) {
      this.logger.error('Error getting market comparison', { userId, periodType, error: error.message });
      throw error;
    }
  }

  /**
   * Reset performance data for user
   */
  async resetPerformance(userId, periodType = null) {
    try {
      const whereClause = { user_id: userId };
      if (periodType) {
        whereClause.period_type = periodType;
      }

      const deleted = await this.Performance.destroy({
        where: whereClause
      });

      this.logger.info('Performance data reset', { userId, periodType, deletedCount: deleted });
      return deleted;
    } catch (error) {
      this.logger.error('Error resetting performance', { userId, periodType, error: error.message });
      throw error;
    }
  }

  /**
   * Clean old performance records
   */
  async cleanOldRecords(daysToKeep = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deleted = await this.Performance.destroy({
        where: {
          period_type: 'daily',
          period_start: {
            [this.database.getSequelize().Op.lt]: cutoffDate
          }
        }
      });

      if (deleted > 0) {
        this.logger.info('Old performance records cleaned', { deleted, daysToKeep });
      }

      return deleted;
    } catch (error) {
      this.logger.error('Error cleaning old performance records', { daysToKeep, error: error.message });
      throw error;
    }
  }
}

module.exports = StatsRepository;