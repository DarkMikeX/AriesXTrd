/**
 * Settings Command
 * Handles the /settings command to manage bot settings
 */

const Logger = require('../utils/Logger');

class SettingsCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Execute the settings command
   */
  async execute(ctx, args) {
    try {
      const userId = ctx.from.id;

      const settingsMessage = `
⚙️ *BOT SETTINGS*

📊 *Trading Settings:*
├─ Auto-Trading: OFF
├─ Min Confidence: 75%
├─ Default Amount: $5
├─ Max Daily Trades: 20
├─ Trade Duration: 5 min

⚠️ *Risk Management:*
├─ Daily Loss Limit: $50
├─ Daily Profit Target: $100
├─ Max Trade Amount: $20
├─ Stop After Losses: 3

🔔 *Notifications:*
├─ Trade Confirmations: ON
├─ Win/Loss Alerts: ON
├─ Daily Summary: ON
├─ Signal Alerts: OFF

🎯 *Preferred Assets:*
[✓] Stocks
[✓] Forex
[ ] Crypto
    `;

      const keyboard = {
        inline_keyboard: [
          [{ text: '📊 Trading Settings', callback_data: 'settings_trading' }],
          [{ text: '⚠️ Risk Management', callback_data: 'settings_risk' }],
          [{ text: '🔔 Notifications', callback_data: 'settings_notifications' }],
          [{ text: '🎯 Asset Preferences', callback_data: 'settings_assets' }],
          [{ text: '💾 Save Settings', callback_data: 'settings_save' }],
          [{ text: '🔙 Back', callback_data: 'back_main' }]
        ]
      };

      await ctx.reply(settingsMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Settings command error', { error: error.message });
      await ctx.reply('❌ Error loading settings. Please try again.');
    }
  }
}

module.exports = SettingsCommand;