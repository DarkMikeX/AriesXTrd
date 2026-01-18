/**
 * Performance Model
 * Tracks user trading performance and statistics
 */

const { DataTypes, Model } = require('sequelize');

class Performance extends Model {
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
      // Time period
      period_type: {
        type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly', 'all_time'),
        allowNull: false,
        comment: 'Time period for these statistics'
      },
      period_start: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Start date of the period'
      },
      period_end: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'End date of the period (null for ongoing periods)'
      },
      // Trade statistics
      total_trades: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total number of trades in this period'
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
      draw_trades: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of draw trades'
      },
      cancelled_trades: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of cancelled trades'
      },
      // Financial results
      total_invested: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00,
        comment: 'Total amount invested in trades'
      },
      total_profit_loss: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00,
        comment: 'Total profit/loss amount'
      },
      net_profit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00,
        comment: 'Net profit after fees and commissions'
      },
      gross_profit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00,
        comment: 'Gross profit before fees'
      },
      gross_loss: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00,
        comment: 'Gross loss amount'
      },
      // Performance ratios
      win_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.00,
        comment: 'Win rate percentage (0-100%)'
      },
      profit_factor: {
        type: DataTypes.DECIMAL(8, 4),
        defaultValue: 0.0000,
        comment: 'Profit factor (gross profit / gross loss)'
      },
      average_win: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Average win amount'
      },
      average_loss: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Average loss amount'
      },
      average_trade: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Average profit/loss per trade'
      },
      largest_win: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Largest single win'
      },
      largest_loss: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Largest single loss'
      },
      // Risk metrics
      max_drawdown: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Maximum drawdown amount'
      },
      max_drawdown_percent: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.00,
        comment: 'Maximum drawdown percentage'
      },
      sharpe_ratio: {
        type: DataTypes.DECIMAL(8, 4),
        allowNull: true,
        comment: 'Sharpe ratio (risk-adjusted return)'
      },
      // Asset performance
      best_performing_asset: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Asset with highest win rate'
      },
      worst_performing_asset: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Asset with lowest win rate'
      },
      asset_performance: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON object with performance by asset',
        get() {
          const rawValue = this.getDataValue('asset_performance');
          return rawValue ? JSON.parse(rawValue) : {};
        },
        set(val) {
          this.setDataValue('asset_performance', JSON.stringify(val));
        }
      },
      // Strategy performance
      strategy_performance: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON object with performance by strategy',
        get() {
          const rawValue = this.getDataValue('strategy_performance');
          return rawValue ? JSON.parse(rawValue) : {};
        },
        set(val) {
          this.setDataValue('strategy_performance', JSON.stringify(val));
        }
      },
      // Time-based metrics
      best_day: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Best performing day'
      },
      worst_day: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Worst performing day'
      },
      best_day_profit: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Profit on best day'
      },
      worst_day_loss: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Loss on worst day'
      },
      // Consecutive statistics
      max_consecutive_wins: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Maximum consecutive wins'
      },
      max_consecutive_losses: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Maximum consecutive losses'
      },
      current_win_streak: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Current consecutive wins'
      },
      current_loss_streak: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Current consecutive losses'
      },
      // Behavioral metrics
      average_trades_per_day: {
        type: DataTypes.DECIMAL(8, 2),
        defaultValue: 0.00,
        comment: 'Average trades per day'
      },
      most_active_hour: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Hour with most trading activity (0-23)'
      },
      most_active_day: {
        type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
        allowNull: true,
        comment: 'Day with most trading activity'
      },
      // Confidence and risk metrics
      average_confidence: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.00,
        comment: 'Average signal confidence'
      },
      risk_reward_ratio: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.00,
        comment: 'Average risk-reward ratio'
      },
      // Platform metrics
      platform_fees: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: 'Total platform fees paid'
      },
      // Metadata
      last_updated: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
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
      modelName: 'Performance',
      tableName: 'performance_stats',
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['period_type']
        },
        {
          fields: ['period_start']
        },
        {
          fields: ['period_end']
        },
        {
          fields: ['win_rate']
        },
        {
          fields: ['total_profit_loss']
        }
      ]
    });

    return this;
  }

  /**
   * Calculate win rate
   */
  calculateWinRate() {
    if (this.total_trades === 0) return 0;
    return ((this.winning_trades / this.total_trades) * 100).toFixed(2);
  }

  /**
   * Calculate profit factor
   */
  calculateProfitFactor() {
    if (this.gross_loss === 0) return this.gross_profit > 0 ? 999 : 0;
    return (this.gross_profit / Math.abs(this.gross_loss)).toFixed(4);
  }

  /**
   * Calculate average win/loss
   */
  calculateAverages() {
    this.average_win = this.winning_trades > 0 ? (this.gross_profit / this.winning_trades).toFixed(2) : 0;
    this.average_loss = this.losing_trades > 0 ? (Math.abs(this.gross_loss) / this.losing_trades).toFixed(2) : 0;
    this.average_trade = this.total_trades > 0 ? (this.total_profit_loss / this.total_trades).toFixed(2) : 0;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    return {
      period: `${this.period_type} (${this.period_start.toISOString().split('T')[0]})`,
      trades: this.total_trades,
      wins: this.winning_trades,
      losses: this.losing_trades,
      win_rate: `${this.win_rate}%`,
      total_pnl: `$${this.total_profit_loss}`,
      average_trade: `$${this.average_trade}`,
      profit_factor: this.profit_factor,
      best_asset: this.best_performing_asset,
      max_drawdown: `$${this.max_drawdown}`
    };
  }

  /**
   * Get ROI (Return on Investment)
   */
  getROI() {
    if (this.total_invested === 0) return 0;
    return ((this.total_profit_loss / this.total_invested) * 100).toFixed(2);
  }

  /**
   * Check if performance is positive
   */
  isPositive() {
    return this.total_profit_loss > 0;
  }

  /**
   * Get performance grade
   */
  getGrade() {
    const winRate = parseFloat(this.win_rate);
    const profitFactor = parseFloat(this.profit_factor);

    if (winRate >= 70 && profitFactor >= 1.5) return 'A+';
    if (winRate >= 65 && profitFactor >= 1.3) return 'A';
    if (winRate >= 60 && profitFactor >= 1.2) return 'B+';
    if (winRate >= 55 && profitFactor >= 1.1) return 'B';
    if (winRate >= 50 && profitFactor >= 1.0) return 'C+';
    if (winRate >= 45) return 'C';
    if (winRate >= 40) return 'D';
    return 'F';
  }

  /**
   * Update performance with new trade data
   */
  updateWithTrade(tradeData) {
    this.total_trades += 1;
    this.total_invested += parseFloat(tradeData.amount);

    if (tradeData.result === 'WIN') {
      this.winning_trades += 1;
      this.gross_profit += parseFloat(tradeData.profit_loss);
    } else if (tradeData.result === 'LOSS') {
      this.losing_trades += 1;
      this.gross_loss += Math.abs(parseFloat(tradeData.profit_loss));
    } else if (tradeData.result === 'DRAW') {
      this.draw_trades += 1;
    }

    this.total_profit_loss = parseFloat(this.gross_profit) - parseFloat(this.gross_loss);
    this.win_rate = parseFloat(this.calculateWinRate());
    this.profit_factor = parseFloat(this.calculateProfitFactor());

    this.calculateAverages();
    this.last_updated = new Date();
    this.updated_at = new Date();
  }

  /**
   * Reset performance data
   */
  reset() {
    // Reset all calculated fields to zero/empty
    this.total_trades = 0;
    this.winning_trades = 0;
    this.losing_trades = 0;
    this.draw_trades = 0;
    this.cancelled_trades = 0;
    this.total_invested = 0;
    this.total_profit_loss = 0;
    this.net_profit = 0;
    this.gross_profit = 0;
    this.gross_loss = 0;
    this.win_rate = 0;
    this.profit_factor = 0;
    this.average_win = 0;
    this.average_loss = 0;
    this.average_trade = 0;
    this.largest_win = 0;
    this.largest_loss = 0;
    this.max_drawdown = 0;
    this.max_drawdown_percent = 0;

    this.last_updated = new Date();
    this.updated_at = new Date();
  }

  /**
   * Export performance data
   */
  exportData() {
    return {
      period: {
        type: this.period_type,
        start: this.period_start,
        end: this.period_end
      },
      statistics: {
        total_trades: this.total_trades,
        win_rate: this.win_rate,
        total_pnl: this.total_profit_loss,
        profit_factor: this.profit_factor,
        average_trade: this.average_trade,
        largest_win: this.largest_win,
        largest_loss: this.largest_loss
      },
      performance: {
        grade: this.getGrade(),
        roi: this.getROI(),
        is_positive: this.isPositive()
      }
    };
  }
}

module.exports = Performance;