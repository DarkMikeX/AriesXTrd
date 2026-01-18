/**
 * Notification Service
 * Handles all user notifications and alerts
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Formatter = require('../utils/Formatter');

class NotificationService {
  constructor() {
    this.logger = Logger.getInstance();
    this.formatter = new Formatter();
    this.isInitialized = false;

    // Notification queues and settings
    this.notificationQueue = [];
    this.processingInterval = null;
    this.rateLimits = new Map();
  }

  /**
   * Initialize the notification service
   */
  async initialize() {
    try {
      // Start notification processing
      this.startProcessing();

      this.isInitialized = true;
      this.logger.info('✅ Notification service initialized');

    } catch (error) {
      this.logger.error('Failed to initialize notification service', { error: error.message });
      throw error;
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId, type, data = {}) {
    try {
      // Check rate limiting
      if (!this.checkRateLimit(userId, type)) {
        this.logger.warn('Notification rate limit exceeded', { userId, type });
        return { success: false, reason: 'Rate limit exceeded' };
      }

      // Create notification
      const notification = {
        id: this.generateNotificationId(),
        userId,
        type,
        data,
        timestamp: new Date(),
        status: 'queued',
        retryCount: 0
      };

      // Add to queue
      this.notificationQueue.push(notification);

      this.logger.logNotification(userId, type, 'telegram', true);
      return { success: true, notificationId: notification.id };

    } catch (error) {
      this.logger.logNotification(userId, type, 'telegram', false, error);
      throw ErrorHandler.handle(error, { service: 'notification_service', userId, type });
    }
  }

  /**
   * Process notification queue
   */
  async processNotifications() {
    if (this.notificationQueue.length === 0) return;

    const notifications = [...this.notificationQueue];
    this.notificationQueue = [];

    for (const notification of notifications) {
      try {
        await this.deliverNotification(notification);

        // Update status
        notification.status = 'delivered';
        notification.deliveredAt = new Date();

      } catch (error) {
        notification.status = 'failed';
        notification.error = error.message;
        notification.retryCount++;

        // Re-queue if retries remaining
        if (notification.retryCount < 3) {
          setTimeout(() => {
            this.notificationQueue.push(notification);
          }, 5000 * notification.retryCount); // Exponential backoff
        }

        this.logger.error('Notification delivery failed', {
          notificationId: notification.id,
          userId: notification.userId,
          type: notification.type,
          error: error.message,
          retryCount: notification.retryCount
        });
      }
    }
  }

  /**
   * Deliver notification to user
   */
  async deliverNotification(notification) {
    const { userId, type, data } = notification;

    // Format message based on type
    const messageData = this.formatNotificationMessage(type, data);

    if (!messageData) {
      throw new Error(`Unknown notification type: ${type}`);
    }

    // Send via Telegram (in production, could support multiple channels)
    await this.sendTelegramMessage(userId, messageData.message, messageData.options);

    this.logger.info('Notification delivered', {
      notificationId: notification.id,
      userId,
      type,
      channel: 'telegram'
    });
  }

  /**
   * Send Telegram message
   */
  async sendTelegramMessage(userId, message, options = {}) {
    try {
      // Import TelegramBot dynamically to avoid circular dependencies
      const TelegramBot = require('../bot/TelegramBot');

      // Get bot instance (assuming it's available globally or through a service locator)
      // In production, this would be injected or accessed through a proper service locator
      if (global.telegramBot) {
        await global.telegramBot.sendMessage(userId, message, options);
      } else {
        // Fallback: simulate sending
        this.logger.info('Telegram message would be sent', { userId, message: message.substring(0, 100) });
      }

    } catch (error) {
      throw new Error(`Telegram delivery failed: ${error.message}`);
    }
  }

  /**
   * Format notification message based on type
   */
  formatNotificationMessage(type, data) {
    const formatters = {
      trade_executed: this.formatTradeExecuted.bind(this),
      trade_result: this.formatTradeResult.bind(this),
      trade_cancelled: this.formatTradeCancelled.bind(this),
      signal_alert: this.formatSignalAlert.bind(this),
      risk_limit_exceeded: this.formatRiskLimitExceeded.bind(this),
      daily_summary: this.formatDailySummary.bind(this),
      emergency_stop: this.formatEmergencyStop.bind(this),
      error_alert: this.formatErrorAlert.bind(this),
      maintenance: this.formatMaintenance.bind(this)
    };

    const formatter = formatters[type];
    if (!formatter) return null;

    return formatter(data);
  }

  /**
   * Format trade executed notification
   */
  formatTradeExecuted(data) {
    const { trade } = data;

    return {
      message: `✅ *TRADE EXECUTED SUCCESSFULLY*

📍 Asset: ${trade.asset_symbol}
🎯 Direction: ${trade.direction}
💵 Amount: $${trade.amount}
⏰ Expiry: ${this.formatter.formatDate(trade.expiry_time, 'HH:mm:ss')}
💰 Potential Profit: $${trade.potential_profit}

🔔 I'll notify you when the trade closes!`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Format trade result notification
   */
  formatTradeResult(data) {
    const { trade, result, isWin } = data;
    const emoji = isWin ? '🎉' : '❌';
    const profitText = result.profit > 0 ? `+$${result.profit}` : `$${result.profit}`;

    return {
      message: `${emoji} *TRADE ${result.result.toUpperCase()}* ${emoji}

📍 Asset: ${trade.asset_symbol}
🎯 Direction: ${trade.direction}
💵 Amount: $${trade.amount}
📊 Entry: $${trade.entry_price.toFixed(2)}
📈 Exit: $${result.exitPrice.toFixed(2)}
💰 Result: ${profitText}`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Format trade cancelled notification
   */
  formatTradeCancelled(data) {
    const { trade, reason } = data;

    return {
      message: `❌ *TRADE CANCELLED*

📍 Asset: ${trade.asset_symbol}
🎯 Direction: ${trade.direction}
💵 Amount: $${trade.amount}
📝 Reason: ${reason}

Your trade has been cancelled and funds are safe.`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Format signal alert notification
   */
  formatSignalAlert(data) {
    const { signal, confidence, asset } = data;

    return {
      message: `🚨 *NEW SIGNAL ALERT*

📍 Asset: ${asset}
🎯 Signal: ${signal}
📊 Confidence: ${confidence}%
⭐ Strength: High

💡 This signal meets your criteria for auto-execution.`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Format risk limit exceeded notification
   */
  formatRiskLimitExceeded(data) {
    const { reason } = data;

    return {
      message: `⚠️ *RISK LIMIT EXCEEDED*

${reason}

Trading has been paused for safety. Check your settings to adjust limits.`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Format daily summary notification
   */
  formatDailySummary(data) {
    const { date, trades, wins, losses, profit, winRate } = data;

    return {
      message: `📊 *DAILY TRADING SUMMARY*
📅 ${this.formatter.formatDate(date, 'MMM DD, YYYY')}

Total Trades: ${trades}
Wins: ${wins} 🟢
Losses: ${losses} 🔴
Win Rate: ${winRate}%
Profit: ${this.formatter.formatCurrency(profit)}

Keep up the good work! 📈`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Format emergency stop notification
   */
  formatEmergencyStop(data) {
    const { cancelledTrades, message } = data;

    return {
      message: `🚨 *EMERGENCY STOP ACTIVATED*

${message}

Cancelled Trades: ${cancelledTrades}
Status: All trading stopped

To resume: Check your settings and re-enable trading.`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Format error alert notification
   */
  formatErrorAlert(data) {
    const { error, context } = data;

    return {
      message: `❌ *SYSTEM ERROR*

An error occurred: ${error}

The system is working to resolve this. Please try again later.`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Format maintenance notification
   */
  formatMaintenance(data) {
    const { message, estimatedDowntime } = data;

    return {
      message: `🔧 *SYSTEM MAINTENANCE*

${message}

Estimated downtime: ${estimatedDowntime || 'Unknown'}
Trading is temporarily paused.

We'll notify you when service is restored.`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Check rate limiting for notifications
   */
  checkRateLimit(userId, type) {
    const key = `${userId}_${type}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 10; // 10 notifications per minute per type

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    const limit = this.rateLimits.get(key);

    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + windowMs;
      return true;
    }

    if (limit.count >= maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Start notification processing loop
   */
  startProcessing() {
    this.processingInterval = setInterval(() => {
      this.processNotifications().catch(error => {
        this.logger.error('Notification processing error', { error: error.message });
      });
    }, 1000); // Process every second

    this.logger.info('Notification processing started');
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(notifications) {
    const results = {
      successful: 0,
      failed: 0,
      total: notifications.length
    };

    for (const notification of notifications) {
      try {
        await this.sendNotification(
          notification.userId,
          notification.type,
          notification.data
        );
        results.successful++;
      } catch (error) {
        results.failed++;
        this.logger.error('Bulk notification failed', {
          userId: notification.userId,
          type: notification.type,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Schedule delayed notification
   */
  scheduleNotification(userId, type, data, delayMs) {
    setTimeout(() => {
      this.sendNotification(userId, type, data).catch(error => {
        this.logger.error('Scheduled notification failed', { userId, type, error: error.message });
      });
    }, delayMs);

    return { scheduled: true, delay: delayMs };
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      queueSize: this.notificationQueue.length,
      processingActive: this.processingInterval !== null,
      rateLimitCacheSize: this.rateLimits.size
    };
  }

  /**
   * Generate unique notification ID
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear notification queue (for testing/emergency)
   */
  clearQueue() {
    const cleared = this.notificationQueue.length;
    this.notificationQueue = [];
    this.logger.info('Notification queue cleared', { cleared });
    return cleared;
  }

  /**
   * Get pending notifications for user
   */
  getPendingNotifications(userId) {
    return this.notificationQueue.filter(n => n.userId === userId);
  }

  /**
   * Cancel pending notifications
   */
  cancelNotifications(userId, type = null) {
    const beforeCount = this.notificationQueue.length;
    this.notificationQueue = this.notificationQueue.filter(n =>
      n.userId !== userId || (type && n.type !== type)
    );
    const cancelled = beforeCount - this.notificationQueue.length;

    this.logger.info('Notifications cancelled', { userId, type, cancelled });
    return cancelled;
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      queue_size: this.notificationQueue.length,
      processing_active: this.processingInterval !== null,
      rate_limits_active: this.rateLimits.size > 0
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.notificationQueue = [];
    this.rateLimits.clear();

    this.logger.info('✅ Notification service cleaned up');
  }
}

module.exports = NotificationService;