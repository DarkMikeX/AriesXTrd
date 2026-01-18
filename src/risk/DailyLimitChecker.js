/**
 * Daily Limit Checker
 * Manages and enforces daily trading limits
 */

const Logger = require('../utils/Logger');

class DailyLimitChecker {
  constructor(database) {
    this.database = database;
    this.logger = Logger.getInstance();
  }

  /**
   * Check if user can place more trades today
   */
  async canPlaceTrade(userId, settings) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      if (!this.database) return { allowed: true };

      const Trade = this.database.getModel('Trade');

      // Count today's trades
      const todayTrades = await Trade.count({
        where: {
          user_id: userId,
          created_at: {
            [this.database.getSequelize().Op.gte]: new Date(today + ' 00:00:00'),
            [this.database.getSequelize().Op.lt]: new Date(today + ' 23:59:59')
          }
        }
      });

      const maxDailyTrades = settings?.max_daily_trades || 20;
      const remaining = Math.max(0, maxDailyTrades - todayTrades);

      return {
        allowed: todayTrades < maxDailyTrades,
        remaining: remaining,
        used: todayTrades,
        limit: maxDailyTrades
      };

    } catch (error) {
      this.logger.error('Failed to check daily trade limit', { userId, error: error.message });
      return { allowed: true, error: error.message };
    }
  }

  /**
   * Check daily loss limit
   */
  async checkDailyLossLimit(userId, settings) {
    try {
      const today = new Date().toISOString().split('T')[0];

      if (!this.database) return { allowed: true };

      const Trade = this.database.getModel('Trade');

      // Calculate today's losses
      const todayTrades = await Trade.findAll({
        where: {
          user_id: userId,
          status: 'CLOSED',
          created_at: {
            [this.database.getSequelize().Op.gte]: new Date(today + ' 00:00:00'),
            [this.database.getSequelize().Op.lt]: new Date(today + ' 23:59:59')
          }
        }
      });

      let todayLosses = 0;
      for (const trade of todayTrades) {
        if (trade.result === 'LOSS') {
          todayLosses += trade.amount;
        }
      }

      const dailyLossLimit = settings?.daily_loss_limit || 50;
      const remaining = Math.max(0, dailyLossLimit - todayLosses);

      return {
        allowed: todayLosses < dailyLossLimit,
        currentLosses: todayLosses,
        remaining: remaining,
        limit: dailyLossLimit
      };

    } catch (error) {
      this.logger.error('Failed to check daily loss limit', { userId, error: error.message });
      return { allowed: true, error: error.message };
    }
  }

  /**
   * Check daily profit target
   */
  async checkDailyProfitTarget(userId, settings) {
    try {
      const today = new Date().toISOString().split('T')[0];

      if (!this.database) return { reached: false };

      const Trade = this.database.getModel('Trade');

      // Calculate today's profits
      const todayTrades = await Trade.findAll({
        where: {
          user_id: userId,
          status: 'CLOSED',
          created_at: {
            [this.database.getSequelize().Op.gte]: new Date(today + ' 00:00:00'),
            [this.database.getSequelize().Op.lt]: new Date(today + ' 23:59:59')
          }
        }
      });

      let todayProfit = 0;
      for (const trade of todayTrades) {
        if (trade.result === 'WIN') {
          todayProfit += trade.profit_loss;
        }
      }

      const dailyProfitTarget = settings?.daily_profit_target || 100;

      return {
        reached: todayProfit >= dailyProfitTarget,
        currentProfit: todayProfit,
        target: dailyProfitTarget,
        remaining: Math.max(0, dailyProfitTarget - todayProfit)
      };

    } catch (error) {
      this.logger.error('Failed to check daily profit target', { userId, error: error.message });
      return { reached: false, error: error.message };
    }
  }

  /**
   * Get today's trading summary
   */
  async getTodaySummary(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      if (!this.database) return null;

      const Trade = this.database.getModel('Trade');

      const todayTrades = await Trade.findAll({
        where: {
          user_id: userId,
          created_at: {
            [this.database.getSequelize().Op.gte]: new Date(today + ' 00:00:00'),
            [this.database.getSequelize().Op.lt]: new Date(today + ' 23:59:59')
          }
        }
      });

      let wins = 0, losses = 0, draws = 0;
      let totalProfit = 0, totalInvested = 0;

      for (const trade of todayTrades) {
        totalInvested += trade.amount;

        if (trade.result === 'WIN') {
          wins++;
          totalProfit += trade.profit_loss;
        } else if (trade.result === 'LOSS') {
          losses++;
          totalProfit += trade.profit_loss;
        } else if (trade.result === 'DRAW') {
          draws++;
        }
      }

      return {
        date: today,
        totalTrades: todayTrades.length,
        wins,
        losses,
        draws,
        winRate: todayTrades.length > 0 ? (wins / todayTrades.length) * 100 : 0,
        totalInvested,
        totalProfit,
        roi: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0
      };

    } catch (error) {
      this.logger.error('Failed to get today summary', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Reset daily counters (for testing or manual reset)
   */
  async resetDailyCounters(userId) {
    try {
      // This would typically be handled by date-based queries
      // For now, just log the action
      this.logger.info('Daily counters reset requested', { userId });
      return true;

    } catch (error) {
      this.logger.error('Failed to reset daily counters', { userId, error: error.message });
      return false;
    }
  }

  /**
   * Check all daily limits
   */
  async checkAllLimits(userId, settings) {
    try {
      const [
        tradeLimit,
        lossLimit,
        profitTarget
      ] = await Promise.all([
        this.canPlaceTrade(userId, settings),
        this.checkDailyLossLimit(userId, settings),
        this.checkDailyProfitTarget(userId, settings)
      ]);

      const allLimits = {
        canTrade: tradeLimit.allowed,
        underLossLimit: lossLimit.allowed,
        profitTargetReached: profitTarget.reached,
        limits: {
          trades: tradeLimit,
          losses: lossLimit,
          profits: profitTarget
        }
      };

      // Determine overall status
      allLimits.allowed = allLimits.canTrade && allLimits.underLossLimit && !allLimits.profitTargetReached;

      return allLimits;

    } catch (error) {
      this.logger.error('Failed to check all limits', { userId, error: error.message });
      return {
        allowed: false,
        error: error.message,
        canTrade: false,
        underLossLimit: true,
        profitTargetReached: false
      };
    }
  }

  /**
   * Get limit violation messages
   */
  getLimitViolationMessages(limits) {
    const messages = [];

    if (!limits.canTrade) {
      messages.push(`Daily trade limit reached (${limits.limits.trades.used}/${limits.limits.trades.limit})`);
    }

    if (!limits.underLossLimit) {
      messages.push(`Daily loss limit reached ($${limits.limits.losses.currentLosses}/$${limits.limits.losses.limit})`);
    }

    if (limits.profitTargetReached) {
      messages.push(`Daily profit target reached ($${limits.limits.profits.currentProfit}/$${limits.limits.profits.target})`);
    }

    return messages;
  }

  /**
   * Log limit violation
   */
  logLimitViolation(userId, violationType, details) {
    this.logger.warn('Daily limit violation', {
      userId,
      violationType,
      details
    });
  }

  /**
   * Get time until limits reset
   */
  getTimeUntilReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilReset = tomorrow - now;
    const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes, milliseconds: timeUntilReset };
  }
}

module.exports = DailyLimitChecker;