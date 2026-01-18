/**
 * User Model
 * Represents a Telegram bot user
 */

const { DataTypes, Model } = require('sequelize');

class User extends Model {
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      telegram_id: {
        type: DataTypes.BIGINT,
        unique: true,
        allowNull: false,
        comment: 'Telegram user ID'
      },
      username: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Telegram username'
      },
      first_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Telegram first name'
      },
      last_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Telegram last name'
      },
      language_code: {
        type: DataTypes.STRING(10),
        defaultValue: 'en',
        comment: 'User language preference'
      },
      is_premium: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Telegram premium status'
      },
      is_bot: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Is this user a bot'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'banned', 'suspended'),
        defaultValue: 'active',
        comment: 'User account status'
      },
      role: {
        type: DataTypes.ENUM('user', 'premium', 'admin'),
        defaultValue: 'user',
        comment: 'User role/permissions'
      },
      // Trading preferences
      auto_trading_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Auto trading enabled'
      },
      min_confidence_threshold: {
        type: DataTypes.INTEGER,
        defaultValue: 75,
        comment: 'Minimum confidence for auto trading'
      },
      default_trade_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 5.00,
        comment: 'Default trade amount'
      },
      max_daily_trades: {
        type: DataTypes.INTEGER,
        defaultValue: 20,
        comment: 'Maximum daily trades allowed'
      },
      // Risk management
      daily_loss_limit: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 50.00,
        comment: 'Daily loss limit'
      },
      daily_profit_target: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 100.00,
        comment: 'Daily profit target'
      },
      max_consecutive_losses: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        comment: 'Max consecutive losses before pause'
      },
      // Notification preferences
      notifications_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Notifications enabled'
      },
      trade_confirmations: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Trade confirmation notifications'
      },
      win_loss_alerts: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Win/loss alert notifications'
      },
      daily_summary: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Daily summary notifications'
      },
      // Statistics
      total_trades: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total number of trades'
      },
      winning_trades: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of winning trades'
      },
      losing_trades: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of losing trades'
      },
      total_profit: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Total profit/loss'
      },
      win_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.00,
        comment: 'Win rate percentage'
      },
      // Account info
      iq_option_email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'IQ Option account email (encrypted)'
      },
      iq_option_balance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Current IQ Option balance'
      },
      // Timestamps
      last_trade_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last trade timestamp'
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last login timestamp'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      indexes: [
        {
          unique: true,
          fields: ['telegram_id']
        },
        {
          fields: ['status']
        },
        {
          fields: ['role']
        },
        {
          fields: ['created_at']
        }
      ]
    });

    return this;
  }

  /**
   * Get user's win rate
   */
  getWinRate() {
    if (this.total_trades === 0) return 0;
    return ((this.winning_trades / this.total_trades) * 100).toFixed(2);
  }

  /**
   * Check if user can trade
   */
  canTrade() {
    return this.status === 'active' || this.status === 'premium';
  }

  /**
   * Check if user has reached daily limits
   */
  hasReachedDailyLimit() {
    // This would be checked against today's trades
    // Implementation depends on trade records
    return false;
  }

  /**
   * Get user's risk profile
   */
  getRiskProfile() {
    const winRate = parseFloat(this.getWinRate());

    if (winRate >= 75) return 'conservative';
    if (winRate >= 60) return 'moderate';
    if (winRate >= 45) return 'aggressive';
    return 'high_risk';
  }

  /**
   * Update trading statistics
   */
  updateStats(tradeResult, profit) {
    this.total_trades += 1;

    if (tradeResult === 'WIN') {
      this.winning_trades += 1;
    } else {
      this.losing_trades += 1;
    }

    this.total_profit += profit;
    this.win_rate = parseFloat(this.getWinRate());
    this.last_trade_at = new Date();
  }

  /**
   * Reset daily statistics
   */
  resetDailyStats() {
    // This method would be called daily to reset daily counters
    // Implementation depends on specific requirements
  }
}

module.exports = User;