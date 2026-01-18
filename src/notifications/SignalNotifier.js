/**
 * Signal Notifier
 * Handles signal-related notifications
 */

const Logger = require('../utils/Logger');

class SignalNotifier {
  constructor(bot, services) {
    this.bot = bot;
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Send signal alert
   */
  async sendSignalAlert(userId, signal) {
    try {
      const message = `🚨 *TRADING SIGNAL DETECTED*

📍 ${signal.asset} (${signal.assetType})
🎯 ${signal.signal} (${signal.type})
📊 Confidence: ${signal.confidence}%
⭐ Strength: ${signal.strength}

${this.formatSignalDetails(signal)}

💡 *Recommended Action:*
Direction: ${signal.type} (Price will go ${signal.type === 'CALL' ? 'UP' : 'DOWN'})
Confidence: ${signal.confidence}%
Quality: ${signal.quality || 'Good'}

${this.formatTechnicalIndicators(signal.indicators)}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Execute $5', callback_data: 'trade_5' }],
          [{ text: '💰 Execute $10', callback_data: 'trade_10' }],
          [{ text: '📊 View Chart', callback_data: 'view_chart' }],
          [{ text: '🔄 Re-analyze', callback_data: `analyze_${signal.asset}` }],
          [{ text: '❌ Dismiss', callback_data: 'cancel' }]
        ]
      };

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Failed to send signal alert', { userId, signal: signal.asset, error: error.message });
    }
  }

  /**
   * Send signal update
   */
  async sendSignalUpdate(userId, signal, updateType) {
    try {
      let message = '';

      switch (updateType) {
        case 'strengthened':
          message = `📈 *SIGNAL STRENGTHENED*

📍 ${signal.asset}
🎯 ${signal.signal} (${signal.type})
📊 Confidence: ${signal.confidence}% (increased)
⭐ Strength: ${signal.strength}

The signal has become stronger!`;
          break;

        case 'weakened':
          message = `📉 *SIGNAL WEAKENED*

📍 ${signal.asset}
🎯 ${signal.signal} (${signal.type})
📊 Confidence: ${signal.confidence}% (decreased)

The signal has weakened. Monitor closely.`;
          break;

        case 'expired':
          message = `⏰ *SIGNAL EXPIRED*

📍 ${signal.asset}
The ${signal.signal} signal is no longer valid.

New signals will be generated as market conditions change.`;
          break;

        default:
          message = `📊 *SIGNAL UPDATE*

📍 ${signal.asset}
🎯 ${signal.signal} (${signal.type})
📊 Confidence: ${signal.confidence}%`;
      }

      await this.sendNotification(userId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Failed to send signal update', { userId, signal: signal.asset, updateType, error: error.message });
    }
  }

  /**
   * Send signal summary
   */
  async sendSignalSummary(userId, signals) {
    try {
      if (signals.length === 0) {
        await this.sendNotification(userId, '📊 *SIGNAL SUMMARY*\n\nNo active signals at this time.', { parse_mode: 'Markdown' });
        return;
      }

      let message = '📊 *ACTIVE SIGNALS SUMMARY*\n\n';

      signals.forEach((signal, index) => {
        message += `${index + 1}. ${signal.asset} - ${signal.signal} (${signal.confidence}%)\n`;
      });

      message += `\n💡 Total Active Signals: ${signals.length}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: 'refresh_signals' }],
          [{ text: '📋 View All', callback_data: 'view_all_signals' }]
        ]
      };

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Failed to send signal summary', { userId, signalCount: signals.length, error: error.message });
    }
  }

  /**
   * Send signal performance report
   */
  async sendSignalPerformance(userId, performance) {
    try {
      const message = `📊 *SIGNAL PERFORMANCE REPORT*

📈 *Overall Accuracy:*
• Total Signals: ${performance.totalSignals}
• Accurate Signals: ${performance.accurateSignals}
• Accuracy Rate: ${performance.accuracyRate}%

🎯 *Signal Types:*
• BUY Signals: ${performance.buySignals} (${performance.buyAccuracy}% accurate)
• SELL Signals: ${performance.sellSignals} (${performance.sellAccuracy}% accurate)

⭐ *Best Performing:*
• Asset: ${performance.bestAsset}
• Accuracy: ${performance.bestAssetAccuracy}%

📊 *Recent Performance:*
Last 10 signals: ${performance.recentAccuracy}/10 accurate
Last 30 signals: ${performance.monthlyAccuracy}/30 accurate

💡 *Improvement Areas:*
${performance.improvements.join('\n')}`;

      await this.sendNotification(userId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Failed to send signal performance', { userId, error: error.message });
    }
  }

  /**
   * Send signal alert settings reminder
   */
  async sendSignalSettingsReminder(userId) {
    try {
      const message = `🔔 *SIGNAL ALERTS REMINDER*

Signal alerts are currently ${this.getAlertStatus(userId)}.

📊 *Benefits of Signal Alerts:*
• Get notified of high-confidence trading opportunities
• Never miss important market moves
• Receive real-time technical analysis

⚙️ *Configure Alerts:*
Use /settings to enable/disable signal notifications.

💡 *Signal Quality:*
• Only alerts with 75%+ confidence
• Includes full technical analysis
• Multiple confirmation indicators`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '⚙️ Settings', callback_data: 'menu_settings' }],
          [{ text: '🔔 Enable Alerts', callback_data: 'enable_signal_alerts' }]
        ]
      };

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Failed to send signal settings reminder', { userId, error: error.message });
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId, message, options = {}) {
    try {
      await this.bot.telegram.sendMessage(userId, message, options);
      this.logger.info('Signal notification sent', { userId });
    } catch (error) {
      this.logger.error('Failed to send signal notification', { userId, error: error.message });
    }
  }

  /**
   * Format signal details
   */
  formatSignalDetails(signal) {
    return `💰 Current Price: $${signal.price}
⏰ Timestamp: ${new Date(signal.timestamp).toLocaleString()}
🎯 Quality: ${signal.quality || 'Good'}
📊 Strength: ${signal.strength}`;
  }

  /**
   * Format technical indicators
   */
  formatTechnicalIndicators(indicators) {
    if (!indicators) return '';

    let formatted = '📈 *Technical Indicators:*\n';

    Object.entries(indicators).forEach(([key, indicator]) => {
      if (indicator && indicator.status) {
        formatted += `├─ ${key}: ${indicator.status}\n`;
      }
    });

    return formatted;
  }

  /**
   * Get alert status for user
   */
  getAlertStatus(userId) {
    // In a real implementation, this would check user settings
    return 'DISABLED';
  }

  /**
   * Send bulk signal alerts
   */
  async sendBulkSignalAlerts(userIds, signal) {
    const results = { successful: 0, failed: 0 };

    for (const userId of userIds) {
      try {
        // Check if user has signal alerts enabled
        const preferences = await this.services.user.getUserNotificationPreferences(userId);
        if (preferences.signalAlerts) {
          await this.sendSignalAlert(userId, signal);
          results.successful++;
        }
      } catch (error) {
        results.failed++;
        this.logger.error('Bulk signal alert failed', { userId, error: error.message });
      }
    }

    this.logger.info('Bulk signal alerts completed', results);
    return results;
  }

  /**
   * Send signal expiration warning
   */
  async sendSignalExpirationWarning(userId, signal) {
    try {
      const message = `⏰ *SIGNAL EXPIRING SOON*

📍 ${signal.asset} ${signal.signal} signal
⏱️ Expires in: ${signal.timeRemaining} minutes
📊 Confidence: ${signal.confidence}%

Consider executing the trade before the signal expires.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Execute Now', callback_data: 'trade_5' }],
          [{ text: '📊 View Details', callback_data: `analyze_${signal.asset}` }]
        ]
      };

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Failed to send signal expiration warning', { userId, signal: signal.asset, error: error.message });
    }
  }
}

module.exports = SignalNotifier;