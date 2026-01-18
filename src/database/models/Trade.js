/**
 * Trade Model
 * Represents a trading transaction
 */

const { DataTypes, Model } = require('sequelize');

class Trade extends Model {
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
        references: {
          model: 'users',
          key: 'id'
        }
      },
      signal_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'signals',
          key: 'id'
        }
      },
      // Trade details
      asset_symbol: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Trading asset symbol (AAPL, EURUSD, BTCUSD)'
      },
      asset_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Full asset name'
      },
      asset_type: {
        type: DataTypes.ENUM('stock', 'forex', 'crypto', 'commodity', 'index'),
        allowNull: false,
        comment: 'Type of asset being traded'
      },
      trade_type: {
        type: DataTypes.ENUM('binary', 'digital', 'cfd'),
        defaultValue: 'binary',
        comment: 'Type of trade (binary options, digital, CFD)'
      },
      direction: {
        type: DataTypes.ENUM('CALL', 'PUT', 'BUY', 'SELL'),
        allowNull: false,
        comment: 'Trade direction (CALL=Higher, PUT=Lower)'
      },
      // Pricing
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Trade amount in USD'
      },
      entry_price: {
        type: DataTypes.DECIMAL(15, 5),
        allowNull: false,
        comment: 'Entry price at trade execution'
      },
      exit_price: {
        type: DataTypes.DECIMAL(15, 5),
        allowNull: true,
        comment: 'Exit price at trade closure'
      },
      payout_rate: {
        type: DataTypes.DECIMAL(5, 4),
        defaultValue: 0.75,
        comment: 'Payout rate (0.75 = 75%)'
      },
      // Timing
      duration_minutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Trade duration in minutes'
      },
      entry_time: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Trade entry timestamp'
      },
      expiry_time: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Trade expiry timestamp'
      },
      exit_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Trade exit timestamp'
      },
      // Results
      status: {
        type: DataTypes.ENUM('OPEN', 'CLOSED', 'CANCELLED', 'EXPIRED'),
        defaultValue: 'OPEN',
        comment: 'Current trade status'
      },
      result: {
        type: DataTypes.ENUM('WIN', 'LOSS', 'DRAW', 'PENDING'),
        allowNull: true,
        comment: 'Trade outcome'
      },
      profit_loss: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Profit or loss amount'
      },
      potential_profit: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Potential profit if trade wins'
      },
      // IQ Option details
      iq_option_trade_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'IQ Option internal trade ID'
      },
      iq_option_balance_before: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'IQ Option balance before trade'
      },
      iq_option_balance_after: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'IQ Option balance after trade'
      },
      // Analysis data
      confidence_score: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Signal confidence score (0-100)'
      },
      indicators_data: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON string of indicator values used'
      },
      // Metadata
      execution_method: {
        type: DataTypes.ENUM('manual', 'auto', 'api'),
        defaultValue: 'manual',
        comment: 'How the trade was executed'
      },
      platform: {
        type: DataTypes.ENUM('iq_option', 'binance', 'mt4', 'mt5'),
        defaultValue: 'iq_option',
        comment: 'Trading platform used'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes about the trade'
      },
      // Error handling
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error message if trade failed'
      },
      retry_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of execution retries'
      },
      // Screenshots/logs
      screenshot_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Path to trade execution screenshot'
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
      modelName: 'Trade',
      tableName: 'trades',
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['signal_id']
        },
        {
          fields: ['asset_symbol']
        },
        {
          fields: ['status']
        },
        {
          fields: ['result']
        },
        {
          fields: ['entry_time']
        },
        {
          fields: ['expiry_time']
        },
        {
          fields: ['created_at']
        }
      ]
    });

    return this;
  }

  /**
   * Calculate potential profit
   */
  calculatePotentialProfit() {
    if (this.amount && this.payout_rate) {
      return (this.amount * this.payout_rate).toFixed(2);
    }
    return 0;
  }

  /**
   * Calculate actual profit/loss
   */
  calculateProfitLoss() {
    if (this.result === 'WIN') {
      return parseFloat(this.calculatePotentialProfit());
    } else if (this.result === 'LOSS') {
      return -parseFloat(this.amount);
    }
    return 0;
  }

  /**
   * Check if trade is expired
   */
  isExpired() {
    return new Date() > this.expiry_time;
  }

  /**
   * Check if trade is profitable based on current price
   */
  isCurrentlyWinning(currentPrice) {
    if (this.direction === 'CALL') {
      return currentPrice > this.entry_price;
    } else if (this.direction === 'PUT') {
      return currentPrice < this.entry_price;
    }
    return false;
  }

  /**
   * Get trade duration in milliseconds
   */
  getDurationMs() {
    return this.duration_minutes * 60 * 1000;
  }

  /**
   * Get time remaining until expiry
   */
  getTimeRemaining() {
    const now = new Date();
    const expiry = new Date(this.expiry_time);
    const remaining = expiry - now;

    if (remaining <= 0) return 0;

    return Math.floor(remaining / 1000); // seconds
  }

  /**
   * Format trade for display
   */
  toDisplayFormat() {
    return {
      id: this.id,
      asset: `${this.asset_symbol} (${this.asset_name})`,
      type: this.direction,
      amount: `$${this.amount}`,
      entry_price: this.entry_price,
      status: this.status,
      result: this.result || 'PENDING',
      profit_loss: this.result ? `$${this.profit_loss}` : `$${this.calculatePotentialProfit()} potential`,
      entry_time: this.entry_time.toLocaleString(),
      expiry_time: this.expiry_time.toLocaleString(),
      time_remaining: this.getTimeRemaining()
    };
  }

  /**
   * Update trade result
   */
  updateResult(exitPrice, result) {
    this.exit_price = exitPrice;
    this.result = result;
    this.exit_time = new Date();
    this.status = 'CLOSED';

    if (result === 'WIN') {
      this.profit_loss = parseFloat(this.calculatePotentialProfit());
    } else if (result === 'LOSS') {
      this.profit_loss = -parseFloat(this.amount);
    }

    this.updated_at = new Date();
  }

  /**
   * Mark trade as cancelled
   */
  cancel(reason = null) {
    this.status = 'CANCELLED';
    this.notes = reason || 'Trade cancelled by user';
    this.updated_at = new Date();
  }
}

module.exports = Trade;