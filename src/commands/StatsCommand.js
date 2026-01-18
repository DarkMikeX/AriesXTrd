/**
 * Stats Command
 * Handles the /stats command to show trading statistics
 */

const Logger = require('../utils/Logger');

class StatsCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Execute the stats command
   */
  async execute(ctx, args) {
    try {
      const userId = ctx.from.id;

      // Get performance data
      const performance = await this.services.performance.getUserPerformanceSummary(userId);

      if (!performance || !performance.periods) {
        await ctx.reply('📊 *TRADING STATISTICS*\n\nNo trading data available yet.\n\nStart trading to build your statistics!', {
          parse_mode: 'Markdown'
        });
        return;
      }

      let statsMessage = '📊 *COMPREHENSIVE TRADING STATISTICS*\n\n';

      // Today's stats
      const today = performance.periods.daily;
      if (today && today.total_trades > 0) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
📅 *TODAY*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${today.total_trades}
• Wins: ${today.winning_trades} (${today.win_rate}%)
• Losses: ${today.losing_trades}
• Profit: ${this.formatCurrency(today.total_profit_loss)}
• ROI: ${today.total_invested > 0 ? ((today.total_profit_loss / today.total_invested) * 100).toFixed(2) : 0}%\n\n`;
      }

      // Weekly stats
      const week = performance.periods.weekly;
      if (week && week.total_trades > 0) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
📅 *THIS WEEK*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${week.total_trades}
• Wins: ${week.winning_trades} (${week.win_rate}%)
• Profit: ${this.formatCurrency(week.total_profit_loss)}
• Avg Trade: ${this.formatCurrency(week.average_trade)}\n\n`;
      }

      // Overall stats
      const user = performance.user;
      if (user && user.total_trades > 0) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
🏆 *OVERALL PERFORMANCE*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${user.total_trades}
• Win Rate: ${user.win_rate}%
• Total Profit: ${this.formatCurrency(user.total_profit)}\n\n`;

        statsMessage += `[📄 Export Report] [📊 Chart View] [🔙 Back]`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '📄 Export Report', callback_data: 'stats_export' }],
          [{ text: '📊 Chart View', callback_data: 'stats_chart' }],
          [{ text: '🔙 Back', callback_data: 'back_main' }]
        ]
      };

      await ctx.reply(statsMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Stats command error', { error: error.message });
      await ctx.reply('❌ Error loading statistics. Please try again.');
    }
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
}

module.exports = StatsCommand;