/**
 * Stop Command
 * Handles the /stop command for emergency trading halt
 */

const Logger = require('../utils/Logger');

class StopCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Execute the stop command
   */
  async execute(ctx, args) {
    try {
      const userId = ctx.from.id;

      const stopMessage = `
🚨 *EMERGENCY STOP ACTIVATED*

⚠️ All trading activities have been stopped.

• Auto-trading: DISABLED
• New trade execution: BLOCKED
• Position monitoring: PAUSED

To resume trading:
1. Check your settings: /settings
2. Enable auto-trading if desired
3. Start new analysis: /analyze

Are you sure you want to stop all trading?
    `;

      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Yes, Stop Everything', callback_data: 'confirm_stop' }],
          [{ text: '❌ Cancel', callback_data: 'cancel' }]
        ]
      };

      await ctx.reply(stopMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Stop command error', { error: error.message });
      await ctx.reply('❌ Error executing stop command. Please try again.');
    }
  }
}

module.exports = StopCommand;