/**
 * Settings Model
 * User-specific bot settings and preferences
 */

const { DataTypes, Model } = require('sequelize');

class Settings extends Model {
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      // Trading Settings
      auto_trading_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Enable automatic trade execution'
      },
      min_confidence_threshold: {
        type: DataTypes.INTEGER,
        defaultValue: 75,
        validate: {
          min: 0,
          max: 100
        },
        comment: 'Minimum confidence score for trades (0-100%)'
      },
      default_trade_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 5.00,
        comment: 'Default trade amount in USD'
      },
      max_trade_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 20.00,
        comment: 'Maximum trade amount allowed'
      },
      default_trade_duration: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        comment: 'Default trade duration in minutes'
      },
      supported_durations: {
        type: DataTypes.STRING(100),
        defaultValue: '1,2,5,15,30,60',
        comment: 'Comma-separated list of allowed durations'
      },
      max_daily_trades: {
        type: DataTypes.INTEGER,
        defaultValue: 20,
        comment: 'Maximum trades allowed per day'
      },
      // Risk Management
      daily_loss_limit: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 50.00,
        comment: 'Daily loss limit in USD'
      },
      daily_profit_target: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 100.00,
        comment: 'Daily profit target in USD'
      },
      max_consecutive_losses: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        comment: 'Maximum consecutive losses before pause'
      },
      max_position_size_percent: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 5.00,
        comment: 'Maximum position size as % of balance'
      },
      stop_loss_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Enable stop loss protection'
      },
      take_profit_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Enable take profit targets'
      },
      cooling_period_minutes: {
        type: DataTypes.INTEGER,
        defaultValue: 15,
        comment: 'Cooling period after losses (minutes)'
      },
      // Asset Preferences
      preferred_assets: {
        type: DataTypes.TEXT,
        defaultValue: '["stocks","forex"]',
        comment: 'JSON array of preferred asset types',
        get() {
          const rawValue = this.getDataValue('preferred_assets');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(val) {
          this.setDataValue('preferred_assets', JSON.stringify(val));
        }
      },
      favorite_stocks: {
        type: DataTypes.TEXT,
        defaultValue: '["AAPL","TSLA","MSFT"]',
        comment: 'JSON array of favorite stock symbols',
        get() {
          const rawValue = this.getDataValue('favorite_stocks');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(val) {
          this.setDataValue('favorite_stocks', JSON.stringify(val));
        }
      },
      favorite_forex: {
        type: DataTypes.TEXT,
        defaultValue: '["EURUSD","GBPUSD","USDJPY"]',
        comment: 'JSON array of favorite forex pairs',
        get() {
          const rawValue = this.getDataValue('favorite_forex');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(val) {
          this.setDataValue('favorite_forex', JSON.stringify(val));
        }
      },
      favorite_crypto: {
        type: DataTypes.TEXT,
        defaultValue: '["BTCUSD","ETHUSD"]',
        comment: 'JSON array of favorite crypto pairs',
        get() {
          const rawValue = this.getDataValue('favorite_crypto');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(val) {
          this.setDataValue('favorite_crypto', JSON.stringify(val));
        }
      },
      // Notification Preferences
      notifications_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Master notification toggle'
      },
      trade_confirmations: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Send trade confirmation notifications'
      },
      win_loss_alerts: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Send win/loss result notifications'
      },
      signal_alerts: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Send new signal notifications'
      },
      daily_summary: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Send daily performance summary'
      },
      weekly_summary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Send weekly performance summary'
      },
      error_alerts: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Send error notifications'
      },
      // Analysis Preferences
      indicators_enabled: {
        type: DataTypes.TEXT,
        defaultValue: '{"rsi":true,"macd":true,"bollinger_bands":true,"ema":true,"sma":true,"stochastic":true,"volume":true}',
        comment: 'JSON object of enabled indicators',
        get() {
          const rawValue = this.getDataValue('indicators_enabled');
          return rawValue ? JSON.parse(rawValue) : {};
        },
        set(val) {
          this.setDataValue('indicators_enabled', JSON.stringify(val));
        }
      },
      analysis_cache_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Enable caching of analysis results'
      },
      cache_ttl_minutes: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        comment: 'Cache time-to-live in minutes'
      },
      // UI Preferences
      language: {
        type: DataTypes.STRING(10),
        defaultValue: 'en',
        comment: 'User interface language'
      },
      timezone: {
        type: DataTypes.STRING(50),
        defaultValue: 'America/New_York',
        comment: 'User timezone'
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'USD',
        comment: 'Display currency'
      },
      theme: {
        type: DataTypes.ENUM('light', 'dark', 'auto'),
        defaultValue: 'dark',
        comment: 'UI theme preference'
      },
      compact_mode: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Use compact UI mode'
      },
      show_charts: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Show charts in analysis'
      },
      show_indicators: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Show indicator values'
      },
      // Automation Settings
      auto_analyze_interval: {
        type: DataTypes.INTEGER,
        defaultValue: 60,
        comment: 'Auto analysis interval in minutes'
      },
      scheduled_trading_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Enable scheduled trading'
      },
      trading_schedule: {
        type: DataTypes.TEXT,
        defaultValue: '{"start":"09:00","end":"17:00","days":["monday","tuesday","wednesday","thursday","friday"]}',
        comment: 'JSON object defining trading schedule',
        get() {
          const rawValue = this.getDataValue('trading_schedule');
          return rawValue ? JSON.parse(rawValue) : {};
        },
        set(val) {
          this.setDataValue('trading_schedule', JSON.stringify(val));
        }
      },
      // IQ Option Integration
      iq_option_auto_login: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Automatically login to IQ Option'
      },
      iq_option_account_type: {
        type: DataTypes.ENUM('REAL', 'DEMO'),
        defaultValue: 'REAL',
        comment: 'IQ Option account type'
      },
      iq_option_balance_check: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Check balance before trades'
      },
      // Advanced Settings
      debug_mode: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Enable debug logging'
      },
      performance_monitoring: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Enable performance monitoring'
      },
      api_rate_limiting: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Enable API rate limiting'
      },
      // Timestamps
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
      modelName: 'Settings',
      tableName: 'user_settings',
      indexes: [
        {
          unique: true,
          fields: ['user_id']
        }
      ]
    });

    return this;
  }

  /**
   * Get supported durations as array
   */
  getSupportedDurations() {
    return this.supported_durations ? this.supported_durations.split(',').map(d => parseInt(d.trim())) : [5];
  }

  /**
   * Check if asset type is preferred
   */
  isAssetPreferred(assetType) {
    return this.preferred_assets.includes(assetType);
  }

  /**
   * Check if user can auto trade
   */
  canAutoTrade() {
    return this.auto_trading_enabled && this.notifications_enabled;
  }

  /**
   * Check if trade meets user's criteria
   */
  canExecuteTrade(amount, confidence, assetType) {
    return (
      amount >= 1 &&
      amount <= this.max_trade_amount &&
      confidence >= this.min_confidence_threshold &&
      this.isAssetPreferred(assetType)
    );
  }

  /**
   * Get user's risk profile
   */
  getRiskProfile() {
    const lossLimit = parseFloat(this.daily_loss_limit);
    const maxAmount = parseFloat(this.max_trade_amount);

    if (lossLimit >= 100 && maxAmount <= 10) return 'conservative';
    if (lossLimit >= 50 && maxAmount <= 25) return 'moderate';
    if (lossLimit >= 25 && maxAmount <= 50) return 'aggressive';
    return 'high_risk';
  }

  /**
   * Get notification preferences summary
   */
  getNotificationSummary() {
    return {
      enabled: this.notifications_enabled,
      trade_confirmations: this.trade_confirmations,
      win_loss_alerts: this.win_loss_alerts,
      signal_alerts: this.signal_alerts,
      daily_summary: this.daily_summary,
      error_alerts: this.error_alerts
    };
  }

  /**
   * Reset to default settings
   */
  resetToDefaults() {
    // This would reset all settings to default values
    // Implementation depends on specific requirements
    this.updated_at = new Date();
  }

  /**
   * Export settings as JSON
   */
  exportSettings() {
    const settings = this.toJSON();
    // Remove sensitive data and metadata
    delete settings.id;
    delete settings.user_id;
    delete settings.created_at;
    delete settings.updated_at;

    return settings;
  }

  /**
   * Import settings from JSON
   */
  importSettings(settingsJson) {
    Object.keys(settingsJson).forEach(key => {
      if (this.rawAttributes[key]) {
        this[key] = settingsJson[key];
      }
    });

    this.updated_at = new Date();
  }
}

module.exports = Settings;