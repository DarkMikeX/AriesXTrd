/**
 * Analyze Command
 * Handles the /analyze command for asset analysis
 */

const Logger = require('../utils/Logger');

class AnalyzeCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Execute the analyze command
   */
  async execute(ctx, args) {
    try {
      const userId = ctx.from.id;

      if (args.length === 0) {
        // Show asset type selection
        await this.showAssetSelection(ctx);
        return;
      }

      const symbol = args[0].toUpperCase();

      // Validate symbol
      if (!this.isValidSymbol(symbol)) {
        await ctx.reply(`❌ Invalid symbol format: ${symbol}\n\nPlease enter a valid symbol like:\n• AAPL (Apple)\n• EURUSD (Euro/Dollar)\n• BTCUSD (Bitcoin)`);
        return;
      }

      // Show analysis in progress
      await ctx.reply(`⏳ Analyzing ${symbol}...\nFetching real-time data from TradingView...\nCalculating 7 technical indicators...\nGenerating signal...`);

      // Perform analysis
      const analysis = await this.services.analysis.analyzeAsset(symbol, undefined, {
        userId,
        includeCharts: false
      });

      if (analysis.formatted) {
        const keyboard = {
          inline_keyboard: [
            [{ text: '✅ Execute $5', callback_data: 'trade_5' }],
            [{ text: '💰 Execute $10', callback_data: 'trade_10' }],
            [{ text: '💵 Custom Amount', callback_data: 'trade_custom' }],
            [{ text: '📊 View Chart', callback_data: 'view_chart' }],
            [{ text: '🔄 Re-analyze', callback_data: `analyze_${symbol}` }],
            [{ text: '❌ Cancel', callback_data: 'cancel' }]
          ]
        };

        await ctx.reply(analysis.formatted.signal_info, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }

    } catch (error) {
      this.logger.error('Analyze command error', { error: error.message });
      await ctx.reply('❌ Analysis failed. Please try again.');
    }
  }

  /**
   * Show asset type selection menu
   */
  async showAssetSelection(ctx) {
    const message = 'Choose what you want to analyze:';
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 Stocks', callback_data: 'menu_stocks' },
          { text: '💱 Forex', callback_data: 'menu_forex' }
        ],
        [
          { text: '🪙 Crypto', callback_data: 'menu_crypto' },
          { text: '🔙 Back', callback_data: 'back_main' }
        ]
      ]
    };

    await ctx.reply(message, { reply_markup: keyboard });
  }

  /**
   * Validate symbol format
   */
  isValidSymbol(symbol) {
    // Basic symbol validation
    return /^[A-Z0-9]{2,10}$/.test(symbol) && symbol.length >= 2;
  }
}

module.exports = AnalyzeCommand;