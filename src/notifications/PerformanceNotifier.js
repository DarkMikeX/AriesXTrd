/**
 * Performance Notifier
 * Handles performance-related notifications
 */

const Logger = require('../utils/Logger');

class PerformanceNotifier {
  constructor(bot, services) {
    this.bot = bot;
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Send daily performance summary
   */
  async sendDailySummary(userId, dailyStats) {
    try {
      const message = `📊 *DAILY PERFORMANCE SUMMARY*

📅 ${new Date().toLocaleDateString()}

📈 *Trading Results:*
• Total Trades: ${dailyStats.totalTrades}
• Wins: ${dailyStats.wins} (${dailyStats.winRate}%)
• Losses: ${dailyStats.losses}
• Profit/Loss: ${this.formatCurrency(dailyStats.totalProfit)}
• ROI: ${dailyStats.roi}%

💰 *Financial Summary:*
• Total Invested: ${this.formatCurrency(dailyStats.totalInvested)}
• Best Trade: ${this.formatCurrency(dailyStats.bestTrade)}
• Worst Trade: ${this.formatCurrency(dailyStats.worstTrade)}
• Average Trade: ${this.formatCurrency(dailyStats.averageTrade)}

🎯 *Top Performers:*
• Best Asset: ${dailyStats.topAsset || 'N/A'}
• Best Timeframe: ${dailyStats.topTimeframe || 'N/A'}

${this.getPerformanceInsights(dailyStats)}

${this.getMotivationalMessage(dailyStats)}`;

      await this.sendNotification(userId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Failed to send daily summary', { userId, error: error.message });
    }
  }

  /**
   * Send weekly performance report
   */
  async sendWeeklyReport(userId, weeklyStats) {
    try {
      const message = `📊 *WEEKLY PERFORMANCE REPORT*

📅 Week of ${new Date().toLocaleDateString()}

📈 *Weekly Overview:*
• Total Trades: ${weeklyStats.totalTrades}
• Win Rate: ${weeklyStats.winRate}%
• Total Profit: ${this.formatCurrency(weeklyStats.totalProfit)}
• Average Daily Trades: ${weeklyStats.averageDailyTrades}
• Best Day: ${weeklyStats.bestDay} (${this.formatCurrency(weeklyStats.bestDayProfit)})

📊 *Asset Performance:*
${this.formatAssetPerformance(weeklyStats.assetPerformance)}

📈 *Trend Analysis:*
• Improving: ${weeklyStats.trend === 'improving' ? '✅' : '❌'}
• Win Rate Trend: ${weeklyStats.winRateTrend > 0 ? '📈' : '📉'} ${Math.abs(weeklyStats.winRateTrend)}%
• Profit Trend: ${weeklyStats.profitTrend > 0 ? '📈' : '📉'} ${this.formatCurrency(Math.abs(weeklyStats.profitTrend))}

💡 *Weekly Insights:*
${weeklyStats.insights.map(insight => `• ${insight}`).join('\n')}

🎯 *Goals for Next Week:*
${weeklyStats.goals.map(goal => `• ${goal}`).join('\n')}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '📈 Detailed Analysis', callback_data: 'weekly_detailed' }],
          [{ text: '🎯 Set Goals', callback_data: 'set_weekly_goals' }]
        ]
      };

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Failed to send weekly report', { userId, error: error.message });
    }
  }

  /**
   * Send monthly performance report
   */
  async sendMonthlyReport(userId, monthlyStats) {
    try {
      const message = `📊 *MONTHLY PERFORMANCE REPORT*

📅 ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}

🏆 *Monthly Achievements:*
• Total Trades: ${monthlyStats.totalTrades}
• Win Rate: ${monthlyStats.winRate}%
• Total Profit: ${this.formatCurrency(monthlyStats.totalProfit)}
• ROI: ${monthlyStats.roi}%
• Best Week: ${monthlyStats.bestWeek} (${this.formatCurrency(monthlyStats.bestWeekProfit)})

💰 *Financial Highlights:*
• Largest Win: ${this.formatCurrency(monthlyStats.largestWin)}
• Largest Loss: ${this.formatCurrency(monthlyStats.largestLoss)}
• Average Win: ${this.formatCurrency(monthlyStats.averageWin)}
• Average Loss: ${this.formatCurrency(monthlyStats.averageLoss)}
• Profit Factor: ${monthlyStats.profitFactor}

🎯 *Asset Performance:*
${this.formatAssetPerformance(monthlyStats.assetPerformance)}

📈 *Progress Tracking:*
• Month-over-Month Growth: ${monthlyStats.momGrowth > 0 ? '📈' : '📉'} ${Math.abs(monthlyStats.momGrowth)}%
• Consistency Score: ${monthlyStats.consistencyScore}/10
• Risk-Adjusted Return: ${monthlyStats.sharpeRatio}

💡 *Key Insights:*
${monthlyStats.insights.map(insight => `• ${insight}`).join('\n')}

🎯 *Recommendations:*
${monthlyStats.recommendations.map(rec => `• ${rec}`).join('\n')}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '📊 Full Report', callback_data: 'monthly_full_report' }],
          [{ text: '🎯 Strategy Review', callback_data: 'strategy_review' }]
        ]
      };

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Failed to send monthly report', { userId, error: error.message });
    }
  }

  /**
   * Send achievement notification
   */
  async sendAchievement(userId, achievement) {
    try {
      let message = '';

      switch (achievement.type) {
        case 'win_streak':
          message = `🔥 *ACHIEVEMENT UNLOCKED!*

🎯 *${achievement.value} Trade Win Streak!*

You've achieved a ${achievement.value} consecutive win streak!
This is an outstanding accomplishment!

🏆 *Rewards:*
• Badge: "Hot Streak Master"
• Bonus XP: +${achievement.value * 10}
• Special Title: "Streak Champion"

Keep up the amazing trading! 🚀`;
          break;

        case 'profit_milestone':
          message = `💰 *PROFIT MILESTONE ACHIEVED!*

🎉 *$${achievement.value} Total Profit!*

Congratulations on reaching $${achievement.value} in total profits!
You're building a successful trading career!

🏆 *Rewards:*
• Badge: "Profit Pioneer"
• Bonus XP: +${Math.floor(achievement.value / 10)}
• Special Title: "Profit Master"

Your dedication is paying off! 💪`;
          break;

        case 'accuracy_milestone':
          message = `🎯 *ACCURACY MILESTONE!*

📊 *${achievement.value}% Win Rate!*

You've achieved a ${achievement.value}% win rate!
This demonstrates exceptional trading skill!

🏆 *Rewards:*
• Badge: "Accuracy Ace"
• Bonus XP: +${achievement.value}
• Special Title: "Precision Trader"

Outstanding precision in your trades! 🎯`;
          break;

        case 'trade_count':
          message = `📈 *TRADING MILESTONE!*

🔢 *${achievement.value} Trades Completed!*

You've completed ${achievement.value} trades!
This shows great dedication to your trading journey!

🏆 *Rewards:*
• Badge: "Dedicated Trader"
• Bonus XP: +${achievement.value}
• Special Title: "Trading Veteran"

Every trade is a step toward mastery! 📚`;
          break;

        default:
          message = `🏆 *ACHIEVEMENT UNLOCKED!*

🎉 *${achievement.title}*

${achievement.description}

🏆 *Rewards:*
${achievement.rewards.map(reward => `• ${reward}`).join('\n')}`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '🏆 View All Achievements', callback_data: 'view_achievements' }],
          [{ text: '📊 Check Stats', callback_data: 'menu_stats' }]
        ]
      };

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      this.logger.info('Achievement notification sent', { userId, achievement: achievement.type });

    } catch (error) {
      this.logger.error('Failed to send achievement notification', { userId, achievement: achievement.type, error: error.message });
    }
  }

  /**
   * Send performance alert
   */
  async sendPerformanceAlert(userId, alertType, data) {
    try {
      let message = '';

      switch (alertType) {
        case 'improving':
          message = `📈 *PERFORMANCE IMPROVING!*

Your trading performance is getting better!

📊 *Recent Progress:*
• Win Rate: ${data.winRate}%
• Profit: ${this.formatCurrency(data.profit)}
• Improvement: +${data.improvement}%

Keep up the great work! You're on the right track.`;
          break;

        case 'declining':
          message = `📉 *PERFORMANCE ALERT*

Your recent performance needs attention.

📊 *Current Stats:*
• Win Rate: ${data.winRate}%
• Recent Losses: ${data.recentLosses}
• Profit Trend: ${this.formatCurrency(data.profitTrend)}

💡 *Suggestions:*
• Review your strategy
• Take a break if needed
• Consider adjusting risk settings

Use /settings to modify your trading parameters.`;
          break;

        case 'stagnant':
          message = `📊 *PERFORMANCE UPDATE*

Your performance has been consistent but not improving.

📊 *Current Level:*
• Win Rate: ${data.winRate}%
• Average Profit: ${this.formatCurrency(data.avgProfit)}
• Trading Frequency: ${data.frequency} trades/day

💡 *To Improve:*
• Try new strategies
• Analyze your best trades
• Consider different assets

Keep learning and adapting! 📚`;
          break;

        default:
          message = `📊 *PERFORMANCE NOTIFICATION*

${data.message || 'Performance update available.'}`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '📊 View Details', callback_data: 'performance_details' }],
          [{ text: '⚙️ Adjust Settings', callback_data: 'menu_settings' }]
        ]
      };

      await this.sendNotification(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Failed to send performance alert', { userId, alertType, error: error.message });
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId, message, options = {}) {
    try {
      await this.bot.telegram.sendMessage(userId, message, options);
      this.logger.info('Performance notification sent', { userId });
    } catch (error) {
      this.logger.error('Failed to send performance notification', { userId, error: error.message });
    }
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(stats) {
    const insights = [];

    if (stats.winRate > 70) {
      insights.push('Excellent win rate! Your strategy is working well.');
    } else if (stats.winRate < 50) {
      insights.push('Consider reviewing your entry/exit criteria.');
    }

    if (stats.totalProfit > 0 && stats.roi > 10) {
      insights.push('Strong ROI! You\'re generating good returns.');
    }

    if (stats.bestTrade > stats.totalProfit * 0.5) {
      insights.push('One trade represents most of your profit. Focus on consistency.');
    }

    return insights.length > 0 ? `💡 *Insights:*\n${insights.map(i => `• ${i}`).join('\n')}\n\n` : '';
  }

  /**
   * Get motivational message
   */
  getMotivationalMessage(stats) {
    if (stats.totalProfit > 50) {
      return '🎉 Fantastic day! You\'re crushing it!';
    } else if (stats.totalProfit > 0) {
      return '👍 Good day! Small profits add up to big gains.';
    } else if (stats.totalTrades > 0) {
      return '💪 Every loss is a learning opportunity. Keep going!';
    } else {
      return '🚀 Ready to start your trading journey? Let\'s make today profitable!';
    }
  }

  /**
   * Format asset performance
   */
  formatAssetPerformance(assetPerformance) {
    if (!assetPerformance || assetPerformance.length === 0) return 'No asset data available';

    return assetPerformance.slice(0, 3).map(asset =>
      `• ${asset.symbol}: ${asset.winRate}% win rate (${this.formatCurrency(asset.profit)} profit)`
    ).join('\n');
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
   * Send progress update
   */
  async sendProgressUpdate(userId, progress) {
    try {
      const message = `📊 *PROGRESS UPDATE*

${progress.message}

📈 *Current Status:*
• Goal: ${progress.goal}
• Progress: ${progress.current}/${progress.target} (${progress.percentage}%)
• Remaining: ${progress.remaining}

${progress.encouragement || 'Keep pushing forward!'} 💪`;

      await this.sendNotification(userId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Failed to send progress update', { userId, error: error.message });
    }
  }
}

module.exports = PerformanceNotifier;