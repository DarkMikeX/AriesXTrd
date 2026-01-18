/**
 * Trade Confirm Menu
 * Handles trade confirmation and execution menus
 */

const Logger = require('../utils/Logger');

class TradeConfirmMenu {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Show trade confirmation
   */
  async showTradeConfirmation(ctx, tradeDetails) {
    const message = `✅ *TRADE READY TO EXECUTE*

📍 Asset: ${tradeDetails.asset}
🎯 Type: Binary Option - ${tradeDetails.direction}
💵 Amount: $${tradeDetails.amount}
⏰ Duration: ${tradeDetails.duration} minutes
💰 Potential Profit: $${tradeDetails.potentialProfit}

${this.formatTradeAnalysis(tradeDetails.analysis)}

Ready to execute this trade?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Execute Trade', callback_data: `execute_trade_${tradeDetails.asset}_${tradeDetails.amount}` },
          { text: '❌ Cancel', callback_data: 'cancel' }
        ],
        [
          { text: '📊 View Full Analysis', callback_data: 'view_analysis' },
          { text: '🔄 Re-analyze', callback_data: `analyze_${tradeDetails.asset}` }
        ]
      ]
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Show amount selection
   */
  async showAmountSelection(ctx, asset, direction) {
    const message = `💵 *SELECT TRADE AMOUNT*

Asset: ${asset}
Direction: ${direction}

Choose your trade amount:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '$1', callback_data: 'trade_1' },
          { text: '$5', callback_data: 'trade_5' },
          { text: '$10', callback_data: 'trade_10' }
        ],
        [
          { text: '$25', callback_data: 'trade_25' },
          { text: '$50', callback_data: 'trade_50' },
          { text: '$100', callback_data: 'trade_100' }
        ],
        [
          { text: '💰 Custom Amount', callback_data: 'trade_custom' },
          { text: '❌ Cancel', callback_data: 'cancel' }
        ]
      ]
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Show trade result
   */
  async showTradeResult(ctx, tradeResult) {
    let message;
    let keyboard;

    if (tradeResult.success) {
      message = `✅ *TRADE EXECUTED SUCCESSFULLY!*

📍 Asset: ${tradeResult.asset}
🎯 Type: ${tradeResult.type}
💵 Investment: $${tradeResult.amount}
📊 Entry Price: $${tradeResult.entryPrice}
⏰ Entry Time: ${tradeResult.entryTime}
⌛ Expiry Time: ${tradeResult.expiryTime}

🔔 I'll monitor this trade and notify you when it closes!`;

      keyboard = {
        inline_keyboard: [
          [{ text: '📊 View Position', callback_data: 'view_position' }],
          [{ text: '⚙️ Settings', callback_data: 'menu_settings' }]
        ]
      };
    } else {
      message = `❌ *TRADE EXECUTION FAILED*

${tradeResult.error || 'Unknown error occurred'}

Please try again or contact support if the problem persists.`;

      keyboard = {
        inline_keyboard: [
          [{ text: '🔄 Try Again', callback_data: `analyze_${tradeResult.asset}` }],
          [{ text: '🆘 Support', callback_data: 'help_support' }]
        ]
      };
    }

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Format trade analysis for display
   */
  formatTradeAnalysis(analysis) {
    if (!analysis) return '';

    return `📊 *TECHNICAL ANALYSIS:*
├─ Signal: ${analysis.signal} (${analysis.confidence}% confidence)
├─ RSI: ${analysis.indicators?.rsi?.status || 'N/A'}
├─ MACD: ${analysis.indicators?.macd?.status || 'N/A'}
├─ Bollinger: ${analysis.indicators?.bollingerBands?.status || 'N/A'}
└─ Volume: ${analysis.indicators?.volume?.trend || 'N/A'}`;
  }

  /**
   * Show trade history menu
   */
  async showTradeHistory(ctx, trades) {
    let message = '📝 *RECENT TRADE HISTORY*\n\n';

    if (trades.length === 0) {
      message += 'No trades found. Start trading to build your history!';
    } else {
      trades.forEach((trade, index) => {
        const result = trade.result === 'WIN' ? '🟢 WIN' : '🔴 LOSS';
        const profit = trade.profit > 0 ? `+$${trade.profit}` : `$${trade.profit}`;
        const date = new Date(trade.entryTime).toLocaleDateString();

        message += `${index + 1}. ${trade.asset} ${trade.direction}\n`;
        message += `   ${result} ${profit} | ${date}\n\n`;
      });
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '📊 View All Trades', callback_data: 'history_all' }],
        [{ text: '📈 Performance Chart', callback_data: 'history_chart' }],
        [{ text: '🔙 Back', callback_data: 'back_main' }]
      ]
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
}

module.exports = TradeConfirmMenu;