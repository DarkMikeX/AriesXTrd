/**
 * Help Command
 * Handles the /help command to show available commands and usage
 */

const Logger = require('../utils/Logger');

class HelpCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Execute the help command
   */
  async execute(ctx, args) {
    try {
      const topic = args[0] || 'general';

      const helpContent = this.getHelpContent(topic);

      const keyboard = {
        inline_keyboard: [
          [{ text: '📊 Trading', callback_data: 'help_trading' }],
          [{ text: '⚙️ Settings', callback_data: 'help_settings' }],
          [{ text: '🆘 Support', callback_data: 'help_support' }],
          [{ text: '🔙 Back', callback_data: 'back_main' }]
        ]
      };

      await ctx.reply(helpContent, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Help command error', { error: error.message });
      await ctx.reply('❌ Error loading help. Please try again.');
    }
  }

  /**
   * Get help content based on topic
   */
  getHelpContent(topic) {
    const helpTopics = {
      general: `🤖 *Trading Bot Help*

*Available Commands:*
/start - Start the bot and show main menu
/help - Show this help message
/analyze <symbol> - Analyze a trading asset
/stats - View your trading statistics
/balance - Check your account balance
/history - View trade history
/settings - Configure bot settings
/stop - Emergency stop all trading

*Examples:*
• /analyze AAPL (Apple stock)
• /analyze EURUSD (Euro/Dollar)
• /analyze BTCUSD (Bitcoin)

*Quick Tips:*
• Use inline keyboards for easier navigation
• Set up risk management in /settings
• Monitor your positions regularly
• Stop trading if you reach your daily limits

For more information, contact support.`,

      trading: `📊 *Trading Help*

*How to Trade:*
1️⃣ Choose asset type (Stocks/Forex/Crypto)
2️⃣ Select specific asset or use /analyze <symbol>
3️⃣ Review technical analysis and signals
4️⃣ Choose trade amount and execute
5️⃣ Monitor trade and receive results

*Understanding Signals:*
• 📊 *Confidence* - How strong the signal is (75%+ recommended)
• ⭐ *Quality* - Signal reliability rating
• 🎯 *Direction* - CALL (price up) or PUT (price down)

*Asset Types:*
• 📱 *Stocks* - AAPL, TSLA, MSFT, GOOGL
• 💱 *Forex* - EURUSD, GBPUSD, USDJPY
• 🪙 *Crypto* - BTCUSD, ETHUSD, BNBUSD`,

      settings: `⚙️ *Settings Help*

*Trading Settings:*
• Auto-Trading: Enable/disable automatic execution
• Min Confidence: Minimum signal strength (75%)
• Default Amount: Default trade amount ($5)
• Max Daily Trades: Daily trade limit (20)
• Trade Duration: How long trades run (5 min)

*Risk Management:*
• Daily Loss Limit: Stop trading after losses ($50)
• Daily Profit Target: Daily profit goal ($100)
• Max Trade Amount: Maximum per-trade amount ($20)
• Stop After Losses: Pause after consecutive losses (3)

*Notifications:*
• Trade Confirmations: Execution confirmations
• Win/Loss Alerts: Trade result notifications
• Daily Summary: End-of-day performance reports
• Signal Alerts: New signal notifications

*Asset Preferences:*
Choose which asset types to trade: Stocks, Forex, Crypto`,

      support: `🆘 *Support & Troubleshooting*

*Common Issues:*

❌ *Bot not responding:*
• Check if bot is online: /status
• Restart conversation: /start
• Contact support if persistent

❌ *Trades not executing:*
• Verify IQ Option credentials in .env
• Check account balance: /balance
• Review risk settings: /settings

❌ *Analysis not working:*
• Try different symbols
• Check internet connection
• Wait a few minutes and retry

*Getting Help:*
• Use /help <topic> for specific help
• Check /status for system health
• Review /stats for performance data

*Contact Support:*
For technical issues or questions:
📧 support@tradingbot.com
💬 @TradingBotSupport

*Emergency:*
Use /stop to immediately halt all trading`
    };

    return helpTopics[topic] || helpTopics.general;
  }
}

module.exports = HelpCommand;