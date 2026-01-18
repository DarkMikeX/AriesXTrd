/**
 * User Repository
 * Data access layer for User model
 */

const Logger = require('../../utils/Logger');

class UserRepository {
  constructor(database) {
    this.database = database;
    this.User = database.getModel('User');
    this.logger = Logger.getInstance();
  }

  /**
   * Find user by Telegram ID
   */
  async findByTelegramId(telegramId) {
    try {
      return await this.User.findOne({
        where: { telegram_id: telegramId }
      });
    } catch (error) {
      this.logger.error('Error finding user by Telegram ID', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Find or create user by Telegram ID
   */
  async findOrCreate(telegramData) {
    try {
      const [user, created] = await this.User.findOrCreate({
        where: { telegram_id: telegramData.id },
        defaults: {
          telegram_id: telegramData.id,
          username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          language_code: telegramData.language_code,
          is_premium: telegramData.is_premium || false,
          last_login_at: new Date()
        }
      });

      if (!created) {
        // Update last login
        user.last_login_at = new Date();
        await user.save();
      }

      return { user, created };
    } catch (error) {
      this.logger.error('Error finding or creating user', { telegramData, error: error.message });
      throw error;
    }
  }

  /**
   * Create new user
   */
  async create(userData) {
    try {
      const user = await this.User.create(userData);
      this.logger.info('User created', { userId: user.id, telegramId: user.telegram_id });
      return user;
    } catch (error) {
      this.logger.error('Error creating user', { userData, error: error.message });
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(userId, updateData) {
    try {
      const [affectedRows] = await this.User.update(updateData, {
        where: { id: userId }
      });

      if (affectedRows > 0) {
        this.logger.info('User updated', { userId, updateData });
        return await this.User.findByPk(userId);
      }

      return null;
    } catch (error) {
      this.logger.error('Error updating user', { userId, updateData, error: error.message });
      throw error;
    }
  }

  /**
   * Update user trading statistics
   */
  async updateTradingStats(userId, tradeResult, profit) {
    try {
      const user = await this.User.findByPk(userId);
      if (!user) return null;

      user.updateStats(tradeResult, profit);
      await user.save();

      this.logger.info('User trading stats updated', {
        userId,
        tradeResult,
        profit,
        newStats: {
          totalTrades: user.total_trades,
          winRate: user.win_rate,
          totalProfit: user.total_profit
        }
      });

      return user;
    } catch (error) {
      this.logger.error('Error updating user trading stats', { userId, tradeResult, profit, error: error.message });
      throw error;
    }
  }

  /**
   * Get users by status
   */
  async findByStatus(status) {
    try {
      return await this.User.findAll({
        where: { status },
        order: [['created_at', 'DESC']]
      });
    } catch (error) {
      this.logger.error('Error finding users by status', { status, error: error.message });
      throw error;
    }
  }

  /**
   * Get users by role
   */
  async findByRole(role) {
    try {
      return await this.User.findAll({
        where: { role },
        order: [['created_at', 'DESC']]
      });
    } catch (error) {
      this.logger.error('Error finding users by role', { role, error: error.message });
      throw error;
    }
  }

  /**
   * Get top performing users
   */
  async getTopPerformers(limit = 10, period = 'all_time') {
    try {
      const users = await this.User.findAll({
        where: {
          total_trades: { [this.database.getSequelize().Op.gt]: 0 }
        },
        order: [['win_rate', 'DESC'], ['total_profit', 'DESC']],
        limit
      });

      return users;
    } catch (error) {
      this.logger.error('Error getting top performers', { limit, period, error: error.message });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      const user = await this.User.findByPk(userId, {
        include: [
          {
            model: this.database.getModel('Trade'),
            as: 'trades',
            where: {
              status: 'CLOSED'
            },
            required: false,
            limit: 100,
            order: [['created_at', 'DESC']]
          }
        ]
      });

      if (!user) return null;

      const trades = user.trades || [];
      const openTrades = await this.database.getModel('Trade').count({
        where: {
          user_id: userId,
          status: 'OPEN'
        }
      });

      return {
        user: {
          id: user.id,
          telegram_id: user.telegram_id,
          username: user.username,
          status: user.status,
          role: user.role,
          total_trades: user.total_trades,
          winning_trades: user.winning_trades,
          losing_trades: user.losing_trades,
          total_profit: user.total_profit,
          win_rate: user.win_rate,
          last_trade_at: user.last_trade_at
        },
        recent_trades: trades.slice(0, 5),
        open_positions: openTrades,
        risk_profile: user.getRiskProfile()
      };
    } catch (error) {
      this.logger.error('Error getting user stats', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Ban or suspend user
   */
  async changeUserStatus(userId, status, reason = null) {
    try {
      const user = await this.User.findByPk(userId);
      if (!user) return null;

      user.status = status;
      if (reason) {
        user.notes = reason;
      }

      await user.save();

      this.logger.info('User status changed', { userId, status, reason });
      return user;
    } catch (error) {
      this.logger.error('Error changing user status', { userId, status, error: error.message });
      throw error;
    }
  }

  /**
   * Get user count by status
   */
  async getUserCountByStatus() {
    try {
      const counts = await this.User.findAll({
        attributes: [
          'status',
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'count']
        ],
        group: ['status']
      });

      const result = {};
      counts.forEach(count => {
        result[count.status] = parseInt(count.dataValues.count);
      });

      return result;
    } catch (error) {
      this.logger.error('Error getting user count by status', { error: error.message });
      throw error;
    }
  }

  /**
   * Search users
   */
  async searchUsers(query, limit = 20) {
    try {
      const whereClause = {};

      if (query) {
        whereClause[this.database.getSequelize().Op.or] = [
          { username: { [this.database.getSequelize().Op.like]: `%${query}%` } },
          { first_name: { [this.database.getSequelize().Op.like]: `%${query}%` } },
          { last_name: { [this.database.getSequelize().Op.like]: `%${query}%` } },
          { telegram_id: query }
        ];
      }

      return await this.User.findAll({
        where: whereClause,
        limit,
        order: [['created_at', 'DESC']]
      });
    } catch (error) {
      this.logger.error('Error searching users', { query, limit, error: error.message });
      throw error;
    }
  }

  /**
   * Delete user (soft delete - change status)
   */
  async deleteUser(userId) {
    try {
      const user = await this.User.findByPk(userId);
      if (!user) return false;

      user.status = 'inactive';
      await user.save();

      this.logger.info('User marked as inactive', { userId });
      return true;
    } catch (error) {
      this.logger.error('Error deleting user', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const newUsers = await this.User.count({
        where: {
          created_at: { [this.database.getSequelize().Op.gte]: startDate }
        }
      });

      const activeUsers = await this.User.count({
        where: {
          last_login_at: { [this.database.getSequelize().Op.gte]: startDate }
        }
      });

      return {
        period_days: days,
        total_users: await this.User.count(),
        new_users: newUsers,
        active_users: activeUsers
      };
    } catch (error) {
      this.logger.error('Error getting user activity summary', { days, error: error.message });
      throw error;
    }
  }
}

module.exports = UserRepository;