/**
 * Settings Menu
 * Handles settings menu interactions
 */

const Logger = require('../utils/Logger');

class SettingsMenu {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Show settings menu
   */
  async show(ctx) {
    const message = `⚙️ *BOT SETTINGS*

Choose what you want to configure:`;

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

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Show trading settings
   */
  async showTradingSettings(ctx) {
    const message = `📊 *TRADING SETTINGS*

• Auto-Trading: OFF
• Min Confidence: 75%
• Default Amount: $5
• Max Daily Trades: 20
• Trade Duration: 5 min

Use the buttons below to modify settings:`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🤖 Auto-Trading', callback_data: 'setting_auto_trading' }],
        [{ text: '📈 Min Confidence', callback_data: 'setting_min_confidence' }],
        [{ text: '💰 Default Amount', callback_data: 'setting_default_amount' }],
        [{ text: '🔢 Max Daily Trades', callback_data: 'setting_max_trades' }],
        [{ text: '⏰ Trade Duration', callback_data: 'setting_trade_duration' }],
        [{ text: '💾 Save Changes', callback_data: 'settings_save' }],
        [{ text: '🔙 Back to Settings', callback_data: 'menu_settings' }]
      ]
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Show risk settings
   */
  async showRiskSettings(ctx) {
    const message = `⚠️ *RISK MANAGEMENT SETTINGS*

• Daily Loss Limit: $50
• Daily Profit Target: $100
• Max Trade Amount: $20
• Stop After Losses: 3 consecutive
• Risk Per Trade: 5% of balance

Configure your risk parameters:`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '📉 Daily Loss Limit', callback_data: 'risk_daily_loss' }],
        [{ text: '📈 Daily Profit Target', callback_data: 'risk_daily_profit' }],
        [{ text: '💵 Max Trade Amount', callback_data: 'risk_max_trade' }],
        [{ text: '🔄 Consecutive Losses', callback_data: 'risk_consecutive' }],
        [{ text: '📊 Risk Per Trade', callback_data: 'risk_per_trade' }],
        [{ text: '💾 Save Changes', callback_data: 'settings_save' }],
        [{ text: '🔙 Back to Settings', callback_data: 'menu_settings' }]
      ]
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
}

module.exports = SettingsMenu;