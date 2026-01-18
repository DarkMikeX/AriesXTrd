/**
 * Start Command
 * Handles the /start command to initialize the bot
 */

const Logger = require('../utils/Logger');

class StartCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Execute the start command
   */
  async execute(ctx, args) {
    try {
      const welcomeMessage = `👋 *Welcome to Trading Bot!*

I analyze stocks, forex & crypto using 7 technical indicators to give you high-accuracy signals.

Choose what you want to trade:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '⭐ Recommended Signal', callback_data: 'menu_recommended' }
          ],
          [
            { text: '📱 Stocks', callback_data: 'menu_stocks' },
            { text: '💱 Forex', callback_data: 'menu_forex' }
          ],
          [
            { text: '🪙 Crypto', callback_data: 'menu_crypto' },
            { text: '📊 My Stats', callback_data: 'menu_stats' }
          ],
          [
            { text: '⚙️ Settings', callback_data: 'menu_settings' }
          ]
        ]
      };

      await ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      // Update user last login if available
      if (ctx.user) {
        ctx.user.last_login_at = new Date();
        await ctx.user.save();
      }

    } catch (error) {
      this.logger.error('Start command error', { error: error.message });
      await ctx.reply('Welcome! There was an error loading the menu. Please try again.');
    }
  }
}

module.exports = StartCommand;