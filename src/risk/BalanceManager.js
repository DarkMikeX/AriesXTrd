/**
 * Balance Manager
 * Manages account balance and trading capital
 */

const Logger = require('../utils/Logger');

class BalanceManager {
  constructor(database, iqOptionBot) {
    this.database = database;
    this.iqOptionBot = iqOptionBot;
    this.logger = Logger.getInstance();
  }

  /**
   * Get current account balance
   */
  async getBalance(userId) {
    try {
      // Try to get real balance from IQ Option
      if (this.iqOptionBot) {
        const realBalance = await this.iqOptionBot.getAccountBalance();
        if (realBalance) {
          // Update cached balance
          await this.updateCachedBalance(userId, realBalance);
          return realBalance;
        }
      }

      // Fallback to cached balance
      return await this.getCachedBalance(userId);

    } catch (error) {
      this.logger.error('Failed to get balance', { userId, error: error.message });
      return await this.getCachedBalance(userId);
    }
  }

  /**
   * Update cached balance
   */
  async updateCachedBalance(userId, balance) {
    try {
      if (!this.database) return;

      const User = this.database.getModel('User');
      await User.update({
        balance: balance,
        last_balance_update: new Date()
      }, {
        where: { id: userId }
      });

    } catch (error) {
      this.logger.error('Failed to update cached balance', { userId, error: error.message });
    }
  }

  /**
   * Get cached balance
   */
  async getCachedBalance(userId) {
    try {
      if (!this.database) return 0;

      const User = this.database.getModel('User');
      const user = await User.findByPk(userId);

      return user?.balance || 0;

    } catch (error) {
      this.logger.error('Failed to get cached balance', { userId, error: error.message });
      return 0;
    }
  }

  /**
   * Check if sufficient balance for trade
   */
  async hasSufficientBalance(userId, amount) {
    try {
      const balance = await this.getBalance(userId);
      const bufferAmount = amount * 1.1; // 10% buffer for fees

      return balance >= bufferAmount;

    } catch (error) {
      this.logger.error('Failed to check balance sufficiency', { userId, amount, error: error.message });
      return false;
    }
  }

  /**
   * Reserve balance for pending trade
   */
  async reserveBalance(userId, amount) {
    try {
      const balance = await this.getBalance(userId);

      if (balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Reserve balance (could implement locking mechanism)
      const newBalance = balance - amount;
      await this.updateCachedBalance(userId, newBalance);

      this.logger.info('Balance reserved', { userId, amount, newBalance });
      return newBalance;

    } catch (error) {
      this.logger.error('Failed to reserve balance', { userId, amount, error: error.message });
      throw error;
    }
  }

  /**
   * Release reserved balance
   */
  async releaseBalance(userId, amount) {
    try {
      const currentBalance = await this.getBalance(userId);
      const newBalance = currentBalance + amount;

      await this.updateCachedBalance(userId, newBalance);

      this.logger.info('Balance released', { userId, amount, newBalance });

    } catch (error) {
      this.logger.error('Failed to release balance', { userId, amount, error: error.message });
    }
  }

  /**
   * Update balance after trade result
   */
  async updateBalanceAfterTrade(userId, tradeResult, amount, profit) {
    try {
      const currentBalance = await this.getBalance(userId);
      let newBalance = currentBalance;

      if (tradeResult === 'WIN') {
        newBalance += profit;
      } else if (tradeResult === 'LOSS') {
        newBalance -= amount; // Amount was already deducted
      }

      await this.updateCachedBalance(userId, newBalance);

      this.logger.info('Balance updated after trade', {
        userId,
        tradeResult,
        amount,
        profit,
        newBalance
      });

      return newBalance;

    } catch (error) {
      this.logger.error('Failed to update balance after trade', {
        userId,
        tradeResult,
        amount,
        profit,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get balance history
   */
  async getBalanceHistory(userId, days = 30) {
    try {
      if (!this.database) return [];

      const Trade = this.database.getModel('Trade');

      // Get trades for the period
      const trades = await Trade.findAll({
        where: {
          user_id: userId,
          status: 'CLOSED'
        },
        order: [['close_time', 'ASC']],
        limit: days * 10 // Approximate trades per day
      });

      const balanceHistory = [];
      let runningBalance = 1000; // Starting balance (could be configurable)

      balanceHistory.push({
        date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        balance: runningBalance
      });

      for (const trade of trades) {
        if (trade.result === 'WIN') {
          runningBalance += trade.profit_loss;
        } else if (trade.result === 'LOSS') {
          runningBalance -= trade.amount;
        }

        balanceHistory.push({
          date: trade.close_time.toISOString().split('T')[0],
          balance: runningBalance
        });
      }

      return balanceHistory;

    } catch (error) {
      this.logger.error('Failed to get balance history', { userId, days, error: error.message });
      return [];
    }
  }

  /**
   * Calculate balance statistics
   */
  async getBalanceStats(userId) {
    try {
      const history = await this.getBalanceHistory(userId, 30);

      if (history.length === 0) return null;

      const currentBalance = history[history.length - 1].balance;
      const startBalance = history[0].balance;
      const change = currentBalance - startBalance;
      const changePercent = startBalance > 0 ? (change / startBalance) * 100 : 0;

      // Calculate daily returns
      const dailyReturns = [];
      for (let i = 1; i < history.length; i++) {
        const dailyChange = history[i].balance - history[i - 1].balance;
        const dailyReturn = history[i - 1].balance > 0 ? (dailyChange / history[i - 1].balance) * 100 : 0;
        dailyReturns.push(dailyReturn);
      }

      const avgDailyReturn = dailyReturns.length > 0 ?
        dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length : 0;

      const volatility = this.calculateVolatility(dailyReturns);

      return {
        current_balance: currentBalance,
        change_amount: change,
        change_percent: changePercent,
        average_daily_return: avgDailyReturn,
        volatility: volatility,
        period_days: 30
      };

    } catch (error) {
      this.logger.error('Failed to calculate balance stats', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Calculate volatility from returns
   */
  calculateVolatility(returns) {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Check balance health
   */
  async checkBalanceHealth(userId) {
    try {
      const balance = await this.getBalance(userId);
      const stats = await this.getBalanceStats(userId);

      const issues = [];

      // Low balance warning
      if (balance < 50) {
        issues.push('CRITICAL: Balance below $50');
      } else if (balance < 100) {
        issues.push('WARNING: Balance below $100');
      }

      // Performance issues
      if (stats) {
        if (stats.change_percent < -20) {
          issues.push('CRITICAL: Lost more than 20% in last 30 days');
        } else if (stats.change_percent < -10) {
          issues.push('WARNING: Lost more than 10% in last 30 days');
        }

        if (stats.volatility > 5) {
          issues.push('HIGH VOLATILITY: Account balance highly volatile');
        }
      }

      return {
        balance,
        healthy: issues.length === 0,
        issues,
        stats
      };

    } catch (error) {
      this.logger.error('Failed to check balance health', { userId, error: error.message });
      return {
        balance: 0,
        healthy: false,
        issues: ['Unable to check balance health'],
        stats: null
      };
    }
  }

  /**
   * Set balance alert thresholds
   */
  async setBalanceAlerts(userId, thresholds) {
    try {
      if (!this.database) return false;

      const User = this.database.getModel('User');
      const user = await User.findByPk(userId);

      if (!user) return false;

      user.balance_alerts = JSON.stringify(thresholds);
      await user.save();

      this.logger.info('Balance alerts set', { userId, thresholds });
      return true;

    } catch (error) {
      this.logger.error('Failed to set balance alerts', { userId, thresholds, error: error.message });
      return false;
    }
  }

  /**
   * Get balance alerts
   */
  async getBalanceAlerts(userId) {
    try {
      if (!this.database) return null;

      const User = this.database.getModel('User');
      const user = await User.findByPk(userId);

      if (!user || !user.balance_alerts) {
        return {
          low_balance: 50,
          critical_balance: 25,
          performance_drop: 10
        };
      }

      return JSON.parse(user.balance_alerts);

    } catch (error) {
      this.logger.error('Failed to get balance alerts', { userId, error: error.message });
      return null;
    }
  }
}

module.exports = BalanceManager;