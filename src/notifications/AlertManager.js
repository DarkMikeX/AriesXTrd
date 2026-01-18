/**
 * Alert Manager
 * Manages all types of alerts and notifications
 */

const Logger = require('../utils/Logger');

class AlertManager {
  constructor(bot, services) {
    this.bot = bot;
    this.services = services;
    this.logger = Logger.getInstance();
    this.alertHistory = new Map();
  }

  /**
   * Send alert to user
   */
  async sendAlert(userId, alertType, data, options = {}) {
    try {
      const alert = this.createAlert(alertType, data);
      const message = this.formatAlertMessage(alert);
      const keyboard = this.getAlertKeyboard(alert);

      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        ...options
      });

      // Store alert in history
      this.storeAlert(userId, alert);

      this.logger.info('Alert sent', { userId, alertType, alertId: alert.id });

    } catch (error) {
      this.logger.error('Failed to send alert', { userId, alertType, error: error.message });
    }
  }

  /**
   * Send emergency alert
   */
  async sendEmergencyAlert(userId, title, message, actionRequired = false) {
    try {
      const alertMessage = `🚨 *EMERGENCY ALERT*

${title}

${message}

${actionRequired ? '⚠️ Action required immediately!' : ''}`;

      const keyboard = actionRequired ? {
        inline_keyboard: [
          [{ text: '✅ Acknowledge', callback_data: 'acknowledge_emergency' }],
          [{ text: '🆘 Support', callback_data: 'contact_support' }]
        ]
      } : undefined;

      await this.bot.telegram.sendMessage(userId, alertMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      this.logger.warn('Emergency alert sent', { userId, title });

    } catch (error) {
      this.logger.error('Failed to send emergency alert', { userId, title, error: error.message });
    }
  }

  /**
   * Send maintenance alert
   */
  async sendMaintenanceAlert(userIds, startTime, duration, message = null) {
    try {
      const alertMessage = `🔧 *SYSTEM MAINTENANCE*

The trading bot will be temporarily unavailable for maintenance.

🕐 Start Time: ${startTime}
⏱️ Duration: ${duration}

${message || 'We apologize for any inconvenience caused.'}

The bot will automatically resume after maintenance is complete.`;

      const results = { successful: 0, failed: 0 };

      for (const userId of userIds) {
        try {
          await this.bot.telegram.sendMessage(userId, alertMessage, {
            parse_mode: 'Markdown'
          });
          results.successful++;
        } catch (error) {
          results.failed++;
          this.logger.error('Failed to send maintenance alert', { userId, error: error.message });
        }
      }

      this.logger.info('Maintenance alerts sent', results);

    } catch (error) {
      this.logger.error('Failed to send maintenance alerts', { error: error.message });
    }
  }

  /**
   * Send risk alert
   */
  async sendRiskAlert(userId, riskType, details) {
    try {
      let title = '';
      let message = '';
      let severity = 'warning';

      switch (riskType) {
        case 'daily_loss_limit':
          title = '🚫 Daily Loss Limit Reached';
          message = `Daily loss limit of $${details.limit} has been reached.\nCurrent loss: $${details.currentLoss}\n\nTrading has been paused for safety.`;
          severity = 'critical';
          break;

        case 'consecutive_losses':
          title = '⚠️ Consecutive Losses Alert';
          message = `${details.count} consecutive losses detected.\nLoss limit: ${details.limit}\n\nCooling period activated.`;
          severity = 'warning';
          break;

        case 'balance_low':
          title = '💰 Low Balance Warning';
          message = `Account balance is getting low.\nCurrent: $${details.current}\nMinimum recommended: $${details.minimum}\n\nConsider adding funds.`;
          severity = 'warning';
          break;

        case 'high_volatility':
          title = '📈 High Volatility Alert';
          message = `Extreme market volatility detected for ${details.asset}.\nVolatility: ${details.volatility}%\n\nExercise caution with trades.`;
          severity = 'info';
          break;

        default:
          title = '⚠️ Risk Alert';
          message = details.message || 'Unknown risk condition detected.';
      }

      const alertMessage = `${this.getSeverityEmoji(severity)} *${title}*

${message}

${severity === 'critical' ? '🚨 Immediate action required!' : ''}`;

      const keyboard = severity === 'critical' ? {
        inline_keyboard: [
          [{ text: '⚙️ Settings', callback_data: 'menu_settings' }],
          [{ text: '🆘 Support', callback_data: 'contact_support' }]
        ]
      } : undefined;

      await this.bot.telegram.sendMessage(userId, alertMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      this.logger.warn('Risk alert sent', { userId, riskType, severity });

    } catch (error) {
      this.logger.error('Failed to send risk alert', { userId, riskType, error: error.message });
    }
  }

  /**
   * Send performance alert
   */
  async sendPerformanceAlert(userId, performanceType, data) {
    try {
      let title = '';
      let message = '';

      switch (performanceType) {
        case 'win_streak':
          title = '🎯 Win Streak Alert';
          message = `Congratulations! You're on a ${data.streak} trade win streak!\n\nKeep up the excellent trading!`;
          break;

        case 'profit_target':
          title = '🎉 Profit Target Reached';
          message = `Daily profit target of $${data.target} has been reached!\nCurrent profit: $${data.current}\n\nGreat job today!`;
          break;

        case 'accuracy_improved':
          title = '📈 Accuracy Improved';
          message = `Your trading accuracy has improved!\nNew accuracy: ${data.newAccuracy}%\nPrevious: ${data.oldAccuracy}%\n\nKeep it up!`;
          break;

        case 'best_trade':
          title = '🏆 New Best Trade';
          message = `Congratulations on your best trade yet!\nProfit: $${data.profit}\nAsset: ${data.asset}\n\nOutstanding performance!`;
          break;

        default:
          title = '📊 Performance Update';
          message = data.message || 'Performance milestone reached!';
      }

      const alertMessage = `🎊 *${title}*

${message}`;

      await this.bot.telegram.sendMessage(userId, alertMessage, {
        parse_mode: 'Markdown'
      });

      this.logger.info('Performance alert sent', { userId, performanceType });

    } catch (error) {
      this.logger.error('Failed to send performance alert', { userId, performanceType, error: error.message });
    }
  }

  /**
   * Send system alert
   */
  async sendSystemAlert(userId, systemType, details) {
    try {
      let title = '';
      let message = '';

      switch (systemType) {
        case 'update_available':
          title = '✨ Update Available';
          message = `A new version (${details.version}) is available!\n\n${details.changes || 'Bug fixes and improvements'}\n\nRestart required: ${details.restartRequired ? 'Yes' : 'No'}`;
          break;

        case 'maintenance_scheduled':
          title = '🔧 Maintenance Scheduled';
          message = `System maintenance scheduled:\n🕐 ${details.time}\n⏱️ Duration: ${details.duration}\n\n${details.message || 'Service will be temporarily unavailable.'}`;
          break;

        case 'service_degraded':
          title = '⚠️ Service Degraded';
          message = `Some services are experiencing issues:\n${details.services.join(', ')}\n\n${details.message || 'Working to restore full functionality.'}`;
          break;

        case 'service_restored':
          title = '✅ Service Restored';
          message = `All services have been restored to normal operation.\n\nThank you for your patience!`;
          break;

        default:
          title = 'ℹ️ System Alert';
          message = details.message || 'System notification';
      }

      const alertMessage = `🔧 *${title}*

${message}`;

      await this.bot.telegram.sendMessage(userId, alertMessage, {
        parse_mode: 'Markdown'
      });

      this.logger.info('System alert sent', { userId, systemType });

    } catch (error) {
      this.logger.error('Failed to send system alert', { userId, systemType, error: error.message });
    }
  }

  /**
   * Create alert object
   */
  createAlert(alertType, data) {
    return {
      id: this.generateAlertId(),
      type: alertType,
      timestamp: new Date(),
      data: data,
      priority: this.getAlertPriority(alertType)
    };
  }

  /**
   * Format alert message
   */
  formatAlertMessage(alert) {
    // This would format different alert types appropriately
    return `📢 *ALERT*\n\n${JSON.stringify(alert.data, null, 2)}`;
  }

  /**
   * Get alert keyboard
   */
  getAlertKeyboard(alert) {
    // Return appropriate keyboard based on alert type
    return {
      inline_keyboard: [[
        { text: '✅ Acknowledge', callback_data: `acknowledge_alert_${alert.id}` }
      ]]
    };
  }

  /**
   * Store alert in history
   */
  storeAlert(userId, alert) {
    if (!this.alertHistory.has(userId)) {
      this.alertHistory.set(userId, []);
    }

    const userAlerts = this.alertHistory.get(userId);
    userAlerts.push(alert);

    // Keep only last 100 alerts per user
    if (userAlerts.length > 100) {
      userAlerts.shift();
    }
  }

  /**
   * Get user alert history
   */
  getUserAlertHistory(userId, limit = 10) {
    const userAlerts = this.alertHistory.get(userId) || [];
    return userAlerts.slice(-limit);
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get alert priority
   */
  getAlertPriority(alertType) {
    const priorities = {
      emergency: 'critical',
      risk_critical: 'critical',
      risk_warning: 'warning',
      system_error: 'high',
      performance: 'medium',
      signal: 'medium',
      system_info: 'low'
    };

    return priorities[alertType] || 'medium';
  }

  /**
   * Get severity emoji
   */
  getSeverityEmoji(severity) {
    const emojis = {
      critical: '🚨',
      high: '⚠️',
      warning: '⚡',
      medium: 'ℹ️',
      low: '📢',
      info: '💡'
    };

    return emojis[severity] || '📢';
  }

  /**
   * Send bulk alerts
   */
  async sendBulkAlerts(userIds, alertType, data, options = {}) {
    const results = { successful: 0, failed: 0 };

    for (const userId of userIds) {
      try {
        await this.sendAlert(userId, alertType, data, options);
        results.successful++;
      } catch (error) {
        results.failed++;
        this.logger.error('Bulk alert failed', { userId, alertType, error: error.message });
      }
    }

    this.logger.info('Bulk alerts completed', { alertType, ...results });
    return results;
  }

  /**
   * Clear user alert history
   */
  clearUserAlertHistory(userId) {
    this.alertHistory.delete(userId);
    this.logger.info('User alert history cleared', { userId });
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics() {
    const stats = {
      totalUsers: this.alertHistory.size,
      totalAlerts: 0,
      alertsByType: {},
      alertsByPriority: {}
    };

    for (const userAlerts of this.alertHistory.values()) {
      stats.totalAlerts += userAlerts.length;

      userAlerts.forEach(alert => {
        stats.alertsByType[alert.type] = (stats.alertsByType[alert.type] || 0) + 1;
        stats.alertsByPriority[alert.priority] = (stats.alertsByPriority[alert.priority] || 0) + 1;
      });
    }

    return stats;
  }
}

module.exports = AlertManager;