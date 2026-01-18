/**
 * History Command
 * Handles the /history command to show trade history
 */

const Logger = require('../utils/Logger');

class HistoryCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Execute the history command
   */
  async execute(ctx, args) {
    try {
      const userId = ctx.from.id;
      const limit = args[0] ? parseInt(args[0]) : 5;

      const history = await this.services.trading.getTradeHistory(userId, { limit });

      if (history.trades.length === 0) {
        await ctx.reply('📝 *TRADE HISTORY*\n\nNo trades found. Start trading to build your history!', {
          parse_mode: 'Markdown'
        });
        return;
      }

      let historyMessage = '📝 *RECENT TRADE HISTORY*\n\n';

      history.trades.forEach((trade, index) => {
        const result = this.formatTradeResult(trade.result, trade.profit);
        const date = new Date(trade.entryTime).toLocaleDateString();

        historyMessage += `${index + 1}. ${trade.asset} ${trade.direction}\n`;
        historyMessage += `   ${result} | ${date}\n\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [{ text: '📊 View All', callback_data: 'history_all' }],
          [{ text: '📈 Performance', callback_data: 'history_performance' }],
          [{ text: '🔙 Back', callback_data: 'back_main' }]
        ]
      };

      await ctx.reply(historyMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('History command error', { error: error.message });
      await ctx.reply('❌ Error loading trade history. Please try again.');
    }
  }

  /**
   * Format trade result for display
   */
  formatTradeResult(result, profit) {
    const emoji = result === 'WIN' ? '🟢' : '🔴';
    const profitText = profit > 0 ? `+$${profit.toFixed(2)}` : `$${profit.toFixed(2)}`;
    return `${emoji} ${result} ${profitText}`;
  }
}

module.exports = HistoryCommand;