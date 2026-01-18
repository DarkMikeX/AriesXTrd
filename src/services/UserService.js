/**
 * User Service
 * Handles user management, authentication, and preferences
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Validator = require('../utils/Validator');

class UserService {
  constructor(database = null) {
    this.database = database;
    this.logger = Logger.getInstance();
    this.isInitialized = false;
  }

  /**
   * Initialize the user service
   */
  async initialize() {
    try {
      this.isInitialized = true;
      this.logger.info('✅ User service initialized');

    } catch (error) {
      this.logger.error('Failed to initialize user service', { error: error.message });
      throw error;
    }
  }

  /**
   * Find or create user by Telegram data
   */
  async findOrCreate(telegramData) {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }

      const User = this.database.getModel('User');
      const Settings = this.database.getModel('Settings');

      // Find or create user
      const [user, created] = await User.findOrCreate({
        where: { telegram_id: telegramData.id },
        defaults: {
          telegram_id: telegramData.id,
          username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          language_code: telegramData.language_code,
          is_premium: telegramData.is_premium || false,
          status: 'active',
          role: 'user',
          last_login_at: new Date()
        }
      });

      // Update last login if user already exists
      if (!created) {
        user.last_login_at = new Date();
        await user.save();
      }

      // Ensure user has settings
      await this.ensureUserSettings(user.id);

      this.logger.info('User processed', {
        userId: user.id,
        telegramId: user.telegram_id,
        created,
        username: user.username
      });

      return { user, created };

    } catch (error) {
      this.logger.error('Error finding or creating user', { telegramData, error: error.message });
      throw ErrorHandler.handle(error, { service: 'user_service', operation: 'find_or_create' });
    }
  }

  /**
   * Ensure user has default settings
   */
  async ensureUserSettings(userId) {
    try {
      const Settings = this.database.getModel('Settings');

      const [settings, created] = await Settings.findOrCreate({
        where: { user_id: userId },
        defaults: {
          user_id: userId,
          auto_trading_enabled: false,
          min_confidence_threshold: 75,
          default_trade_amount: 5,
          max_trade_amount: 20,
          max_daily_trades: 20,
          daily_loss_limit: 50,
          daily_profit_target: 100,
          max_consecutive_losses: 3,
          max_position_size_percent: 5,
          cooling_period_minutes: 15,
          preferred_assets: ['stocks', 'forex'],
          notifications_enabled: true
        }
      });

      if (created) {
        this.logger.info('Default settings created for user', { userId });
      }

      return settings;

    } catch (error) {
      this.logger.error('Error ensuring user settings', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      if (!this.database) return null;

      const User = this.database.getModel('User');
      const user = await User.findByPk(userId, {
        include: [
          {
            model: this.database.getModel('Settings'),
            as: 'settings'
          }
        ]
      });

      return user;

    } catch (error) {
      this.logger.error('Error getting user by ID', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user by Telegram ID
   */
  async getUserByTelegramId(telegramId) {
    try {
      if (!this.database) return null;

      const User = this.database.getModel('User');
      const user = await User.findOne({
        where: { telegram_id: telegramId },
        include: [
          {
            model: this.database.getModel('Settings'),
            as: 'settings'
          }
        ]
      });

      return user;

    } catch (error) {
      this.logger.error('Error getting user by Telegram ID', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updates) {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }

      const User = this.database.getModel('User');
      const allowedFields = [
        'username', 'first_name', 'last_name', 'language_code',
        'is_premium', 'timezone', 'currency'
      ];

      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid fields to update');
      }

      const [affectedRows] = await User.update(filteredUpdates, {
        where: { id: userId }
      });

      if (affectedRows === 0) {
        throw new Error('User not found');
      }

      const updatedUser = await this.getUserById(userId);

      this.logger.info('User profile updated', { userId, updates: Object.keys(filteredUpdates) });
      return updatedUser;

    } catch (error) {
      this.logger.error('Error updating user profile', { userId, updates, error: error.message });
      throw error;
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId, settings) {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }

      const Settings = this.database.getModel('Settings');

      // Validate settings
      const validation = this.validateSettings(settings);
      if (!validation.valid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }

      const [settingsRecord, created] = await Settings.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId }
      });

      await settingsRecord.update(settings);

      this.logger.info('User settings updated', { userId, settings: Object.keys(settings) });
      return settingsRecord;

    } catch (error) {
      this.logger.error('Error updating user settings', { userId, settings, error: error.message });
      throw error;
    }
  }

  /**
   * Get user settings
   */
  async getUserSettings(userId) {
    try {
      if (!this.database) return this.getDefaultSettings();

      const Settings = this.database.getModel('Settings');
      const settings = await Settings.findOne({
        where: { user_id: userId }
      });

      return settings ? settings.toJSON() : this.getDefaultSettings();

    } catch (error) {
      this.logger.error('Error getting user settings', { userId, error: error.message });
      return this.getDefaultSettings();
    }
  }

  /**
   * Get default settings
   */
  getDefaultSettings() {
    return {
      auto_trading_enabled: false,
      min_confidence_threshold: 75,
      default_trade_amount: 5,
      max_trade_amount: 20,
      max_daily_trades: 20,
      daily_loss_limit: 50,
      daily_profit_target: 100,
      max_consecutive_losses: 3,
      max_position_size_percent: 5,
      cooling_period_minutes: 15,
      preferred_assets: ['stocks', 'forex'],
      notifications_enabled: true,
      timezone: 'America/New_York',
      currency: 'USD'
    };
  }

  /**
   * Validate settings
   */
  validateSettings(settings) {
    const errors = [];
    const validators = {
      auto_trading_enabled: (v) => typeof v === 'boolean',
      min_confidence_threshold: (v) => Number.isInteger(v) && v >= 0 && v <= 100,
      default_trade_amount: (v) => typeof v === 'number' && v > 0,
      max_trade_amount: (v) => typeof v === 'number' && v > 0,
      max_daily_trades: (v) => Number.isInteger(v) && v > 0,
      daily_loss_limit: (v) => typeof v === 'number' && v >= 0,
      daily_profit_target: (v) => typeof v === 'number' && v >= 0,
      max_consecutive_losses: (v) => Number.isInteger(v) && v > 0,
      max_position_size_percent: (v) => typeof v === 'number' && v > 0 && v <= 100,
      cooling_period_minutes: (v) => Number.isInteger(v) && v >= 0,
      preferred_assets: (v) => Array.isArray(v),
      notifications_enabled: (v) => typeof v === 'boolean'
    };

    Object.entries(settings).forEach(([key, value]) => {
      if (validators[key] && !validators[key](value)) {
        errors.push(`Invalid value for ${key}: ${value}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Update user trading statistics
   */
  async updateTradingStats(userId, tradeResult, profit) {
    try {
      if (!this.database) return;

      const User = this.database.getModel('User');
      const user = await User.findByPk(userId);

      if (!user) return;

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

    } catch (error) {
      this.logger.error('Error updating user trading stats', { userId, tradeResult, profit, error: error.message });
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      if (!this.database) return null;

      const user = await this.getUserById(userId);
      if (!user) return null;

      const Trade = this.database.getModel('Trade');
      const Signal = this.database.getModel('Signal');

      // Get recent trades
      const recentTrades = await Trade.findAll({
        where: { user_id: userId },
        limit: 10,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'asset_symbol', 'result', 'profit_loss', 'created_at']
      });

      // Get open positions
      const openPositions = await Trade.count({
        where: {
          user_id: userId,
          status: 'OPEN'
        }
      });

      // Get signals count
      const totalSignals = await Signal.count({
        where: { user_id: userId }
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
          last_trade_at: user.last_trade_at,
          created_at: user.created_at,
          last_login_at: user.last_login_at
        },
        recent_trades: recentTrades.map(trade => trade.toJSON()),
        open_positions: openPositions,
        total_signals: totalSignals,
        settings: user.settings ? user.settings.toJSON() : this.getDefaultSettings()
      };

    } catch (error) {
      this.logger.error('Error getting user stats', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Check if user has permission for action
   */
  async hasPermission(userId, permission) {
    try {
      const user = await this.getUserById(userId);

      if (!user) return false;

      // Admin has all permissions
      if (user.role === 'admin') return true;

      // Premium users have additional permissions
      if (user.is_premium) {
        const premiumPermissions = [
          'advanced_analysis',
          'unlimited_trades',
          'priority_support'
        ];

        if (premiumPermissions.includes(permission)) return true;
      }

      // Basic user permissions
      const basicPermissions = [
        'basic_analysis',
        'daily_trades',
        'standard_support'
      ];

      return basicPermissions.includes(permission);

    } catch (error) {
      this.logger.error('Error checking user permission', { userId, permission, error: error.message });
      return false;
    }
  }

  /**
   * Get users by status
   */
  async getUsersByStatus(status, limit = 50) {
    try {
      if (!this.database) return [];

      const User = this.database.getModel('User');
      const users = await User.findAll({
        where: { status },
        limit,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: this.database.getModel('Settings'),
            as: 'settings'
          }
        ]
      });

      return users.map(user => user.toJSON());

    } catch (error) {
      this.logger.error('Error getting users by status', { status, error: error.message });
      throw error;
    }
  }

  /**
   * Get user count by status
   */
  async getUserCountByStatus() {
    try {
      if (!this.database) return {};

      const User = this.database.getModel('User');
      const counts = await User.findAll({
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
   * Change user status
   */
  async changeUserStatus(userId, newStatus, reason = null) {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }

      const User = this.database.getModel('User');
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const validStatuses = ['active', 'inactive', 'suspended', 'banned'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
      }

      user.status = newStatus;
      if (reason) {
        user.notes = reason;
      }

      await user.save();

      this.logger.info('User status changed', {
        userId,
        oldStatus: user.previous('status'),
        newStatus,
        reason
      });

      return user;

    } catch (error) {
      this.logger.error('Error changing user status', { userId, newStatus, error: error.message });
      throw error;
    }
  }

  /**
   * Search users
   */
  async searchUsers(query, limit = 20) {
    try {
      if (!this.database) return [];

      const User = this.database.getModel('User');
      const whereClause = {};

      if (query) {
        whereClause[this.database.getSequelize().Op.or] = [
          { username: { [this.database.getSequelize().Op.like]: `%${query}%` } },
          { first_name: { [this.database.getSequelize().Op.like]: `%${query}%` } },
          { last_name: { [this.database.getSequelize().Op.like]: `%${query}%` } },
          { telegram_id: query }
        ];
      }

      const users = await User.findAll({
        where: whereClause,
        limit,
        order: [['created_at', 'DESC']]
      });

      return users.map(user => user.toJSON());

    } catch (error) {
      this.logger.error('Error searching users', { query, limit, error: error.message });
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(days = 30) {
    try {
      if (!this.database) return null;

      const User = this.database.getModel('User');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const newUsers = await User.count({
        where: {
          created_at: { [this.database.getSequelize().Op.gte]: startDate }
        }
      });

      const activeUsers = await User.count({
        where: {
          last_login_at: { [this.database.getSequelize().Op.gte]: startDate }
        }
      });

      const totalUsers = await User.count();

      return {
        period_days: days,
        total_users: totalUsers,
        new_users: newUsers,
        active_users: activeUsers,
        inactive_users: totalUsers - activeUsers
      };

    } catch (error) {
      this.logger.error('Error getting user activity summary', { days, error: error.message });
      throw error;
    }
  }

  /**
   * Export user data (for GDPR compliance)
   */
  async exportUserData(userId) {
    try {
      const userStats = await this.getUserStats(userId);

      if (!userStats) {
        throw new Error('User not found');
      }

      const exportData = {
        user: userStats.user,
        settings: userStats.settings,
        trading_stats: {
          total_trades: userStats.user.total_trades,
          winning_trades: userStats.user.winning_trades,
          losing_trades: userStats.user.losing_trades,
          total_profit: userStats.user.total_profit,
          win_rate: userStats.user.win_rate
        },
        recent_trades: userStats.recent_trades,
        open_positions: userStats.open_positions,
        total_signals: userStats.total_signals,
        export_date: new Date(),
        data_retention: 'As per platform terms'
      };

      this.logger.info('User data exported', { userId });
      return exportData;

    } catch (error) {
      this.logger.error('Error exporting user data', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete user account (GDPR compliance)
   */
  async deleteUserAccount(userId, reason = null) {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }

      const User = this.database.getModel('User');
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Soft delete - mark as inactive
      user.status = 'deleted';
      user.notes = `Account deleted: ${reason || 'User requested'}`;
      await user.save();

      // Note: In production, you might want to anonymize or hard delete data
      // based on your privacy policy and legal requirements

      this.logger.info('User account marked as deleted', { userId, reason });
      return true;

    } catch (error) {
      this.logger.error('Error deleting user account', { userId, error: error.message });
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
    this.logger.info('✅ User service cleaned up');
  }
}

module.exports = UserService;