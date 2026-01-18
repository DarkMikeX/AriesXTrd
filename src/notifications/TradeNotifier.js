/**
 * Trade Notifier
 * Handles trade-related notifications
 */

const Logger = require('../utils/Logger');

class TradeNotifier {
  constructor(bot, services) {
    this.bot = bot;
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Send trade execution confirmation
   */
  async sendTradeConfirmation(userId, trade) {
    try {
      const message = `✅ *TRADE EXECUTED*

📍 Asset: ${trade.asset}
🎯 Direction: ${trade.direction}
💵 Amount: $${trade.amount}
⏰ Entry Time: ${new Date(trade.entryTime).toLocaleString()}
⌛ Expiry: ${trade.duration} minutes

🔔 I'll notify you when this trade closes!`;

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📊 View Position', callback_data: 'view_position' }
          ]]
        }
      });

    } catch (error) {
      this.logger.error('Failed to send trade confirmation', { userId, tradeId: trade.id, error: error.message });
    }
  }

  /**
   * Send trade result notification
   */
  async sendTradeResult(userId, trade) {
    try {
      const isWin = trade.result === 'WIN';
      const emoji = isWin ? '🎉' : '❌';
      const resultText = isWin ? 'YOU WON' : 'LOSS';

      const message = `${emoji} *TRADE CLOSED - ${resultText}* ${emoji}

📍 Asset: ${trade.asset}
🎯 Direction: ${trade.direction}
💵 Investment: $${trade.amount}
📊 Entry: $${trade.entryPrice}
📈 Exit: $${trade.exitPrice || 'N/A'}
💰 ${isWin ? 'Profit' : 'Loss'}: ${isWin ? '+' : ''}$${trade.profit}

${this.formatTradeStats(trade)}`;

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Trade Again', callback_data: `analyze_${trade.asset}` }],
            [{ text: '📊 View Stats', callback_data: 'menu_stats' }]
          ]
        }
      });

    } catch (error) {
      this.logger.error('Failed to send trade result', { userId, tradeId: trade.id, error: error.message });
    }
  }

  /**
   * Send trade alert for auto-trading
   */
  async sendTradeAlert(userId, signal) {
    try {
      const message = `🚨 *NEW SIGNAL DETECTED*

📍 ${signal.asset} (${signal.assetType})
🎯 ${signal.signal} (${signal.type})
📊 Confidence: ${signal.confidence}%

Auto-execution in 30 seconds...

${this.formatSignalDetails(signal)}`;

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Confirm', callback_data: `confirm_auto_trade_${signal.asset}` }],
            [{ text: '❌ Cancel', callback_data: 'cancel_auto_trade' }]
          ]
        }
      });

    } catch (error) {
      this.logger.error('Failed to send trade alert', { userId, error: error.message });
    }
  }

  /**
   * Send risk management alert
   */
  async sendRiskAlert(userId, alertType, details) {
    try {
      let message = '';

      switch (alertType) {
        case 'daily_loss_limit':
          message = `⚠️ *RISK ALERT: Daily Loss Limit Reached*

💰 Daily Loss: $${details.currentLoss}
📊 Limit: $${details.limit}

Trading has been paused for safety.

To resume: /settings → Risk Management`;
          break;

        case 'consecutive_losses':
          message = `⚠️ *RISK ALERT: Consecutive Losses*

🔴 Losses in a row: ${details.consecutiveLosses}
📊 Limit: ${details.limit}

Cooling period activated.

To resume: /settings → Risk Management`;
          break;

        case 'balance_low':
          message = `⚠️ *BALANCE ALERT*

💰 Current Balance: $${details.balance}
📊 Minimum Required: $${details.minimum}

Please add funds or reduce position sizes.`;
          break;

        default:
          message = `⚠️ *RISK ALERT*

${details.message || 'Unknown risk condition detected'}`;
      }

      await this.sendNotification(userId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Failed to send risk alert', { userId, alertType, error: error.message });
    }
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(userId, summary) {
    try {
      const message = `📊 *DAILY TRADING SUMMARY*

📅 ${new Date().toLocaleDateString()}

📈 *Performance:*
• Trades: ${summary.totalTrades}
• Wins: ${summary.wins} (${summary.winRate}%)
• Profit: ${this.formatCurrency(summary.totalProfit)}
• ROI: ${summary.roi}%

💰 *Financial:*
• Invested: ${this.formatCurrency(summary.totalInvested)}
• Best Trade: ${this.formatCurrency(summary.bestTrade)}
• Worst Trade: ${this.formatCurrency(summary.worstTrade)}

🎯 *Top Asset:* ${summary.topAsset || 'N/A'}
⭐ *Win Streak:* ${summary.winStreak || 0} trades

Keep up the great trading! 🚀`;

      await this.sendNotification(userId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Failed to send daily summary', { userId, error: error.message });
    }
  }

  /**
   * Send system alert
   */
  async sendSystemAlert(userId, alertType, details) {
    try {
      let message = '';

      switch (alertType) {
        case 'maintenance':
          message = `🔧 *SYSTEM MAINTENANCE*

${details.message || 'The bot will be temporarily unavailable for maintenance.'}

Expected downtime: ${details.duration || 'Unknown'}
We apologize for any inconvenience.`;
          break;

        case 'update':
          message = `✨ *BOT UPDATE AVAILABLE*

${details.message || 'A new version is available with improved features.'}

Update: ${details.version || 'Unknown'}
Restart required: ${details.restartRequired ? 'Yes' : 'No'}`;
          break;

        case 'error':
          message = `❌ *SYSTEM ERROR*

${details.message || 'An unexpected error occurred.'}

Error ID: ${details.errorId || 'Unknown'}
Support has been notified.`;
          break;

        default:
          message = `ℹ️ *SYSTEM ALERT*

${details.message || 'System notification'}`;
      }

      await this.sendNotification(userId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Failed to send system alert', { userId, alertType, error: error.message });
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId, message, options = {}) {
    try {
      await this.bot.telegram.sendMessage(userId, message, options);
      this.logger.info('Notification sent', { userId, type: 'trade' });
    } catch (error) {
      this.logger.error('Failed to send notification', { userId, error: error.message });

      // Could implement retry logic or fallback notification methods here
    }
  }

  /**
   * Format trade statistics
   */
  formatTradeStats(trade) {
    if (!trade.closeTime) return '';

    const duration = Math.round((new Date(trade.closeTime) - new Date(trade.entryTime)) / 1000 / 60);
    const movement = trade.exitPrice ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(2) : 'N/A';

    return `━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Duration: ${duration} minutes
📊 Movement: ${movement}%
💼 Open Positions: ${trade.openPositions || 1}
📅 Today's Trades: ${trade.todayTrades || 1}`;
  }

  /**
   * Format signal details
   */
  formatSignalDetails(signal) {
    return `📈 *Technical Analysis:*
├─ RSI: ${signal.indicators?.rsi?.status || 'N/A'}
├─ MACD: ${signal.indicators?.macd?.status || 'N/A'}
├─ Bollinger: ${signal.indicators?.bollinger?.status || 'N/A'}
├─ 50 EMA: ${signal.indicators?.ema?.status || 'N/A'}
└─ Volume: ${signal.indicators?.volume?.status || 'N/A'}`;
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(userIds, message, options = {}) {
    const results = { successful: 0, failed: 0 };

    for (const userId of userIds) {
      try {
        await this.sendNotification(userId, message, options);
        results.successful++;
      } catch (error) {
        results.failed++;
        this.logger.error('Bulk notification failed', { userId, error: error.message });
      }
    }

    this.logger.info('Bulk notifications completed', results);
    return results;
  }

  /**
   * Get notification preferences for user
   */
  async getUserNotificationPreferences(userId) {
    try {
      const settings = await this.services.user.getUserSettings(userId);
      return {
        tradeConfirmations: settings.notifications_enabled,
        winLossAlerts: settings.notifications_enabled,
        dailySummary: settings.notifications_enabled,
        signalAlerts: false, // Default off to avoid spam
        riskAlerts: true, // Always on for safety
        systemAlerts: true // Always on for important updates
      };
    } catch (error) {
      this.logger.error('Failed to get notification preferences', { userId, error: error.message });
      return {
        tradeConfirmations: true,
        winLossAlerts: true,
        dailySummary: true,
        signalAlerts: false,
        riskAlerts: true,
        systemAlerts: true
      };
    }
  }
}

module.exports = TradeNotifier;