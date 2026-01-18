/**
 * Forex Menu
 * Handles forex-specific menu interactions
 */

const Logger = require('../utils/Logger');

class ForexMenu {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Show forex menu
   */
  async show(ctx) {
    const message = `Select a forex pair to analyze:\n\n💱 *Major Pairs:*\n• EURUSD - Euro vs US Dollar\n• GBPUSD - British Pound vs US Dollar\n• USDJPY - US Dollar vs Japanese Yen\n• USDCHF - US Dollar vs Swiss Franc\n• AUDUSD - Australian Dollar vs US Dollar`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🇪🇺🇺🇸 EURUSD', callback_data: 'analyze_EURUSD' },
          { text: '🇬🇧🇺🇸 GBPUSD', callback_data: 'analyze_GBPUSD' }
        ],
        [
          { text: '🇺🇸🇯🇵 USDJPY', callback_data: 'analyze_USDJPY' },
          { text: '🇺🇸🇨🇭 USDCHF', callback_data: 'analyze_USDCHF' }
        ],
        [
          { text: '🇦🇺🇺🇸 AUDUSD', callback_data: 'analyze_AUDUSD' },
          { text: '🇨🇦🇺🇸 USDCAD', callback_data: 'analyze_USDCAD' }
        ],
        [
          { text: '🔙 Back', callback_data: 'back_main' },
          { text: '✏️ Custom Pair', callback_data: 'analyze_custom' }
        ]
      ]
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Get forex pair information
   */
  getForexInfo(pair) {
    const pairs = {
      'EURUSD': { name: 'Euro vs US Dollar', description: 'Most traded currency pair' },
      'GBPUSD': { name: 'British Pound vs US Dollar', description: 'Highly volatile major pair' },
      'USDJPY': { name: 'US Dollar vs Japanese Yen', description: 'Safe haven currency pair' },
      'USDCHF': { name: 'US Dollar vs Swiss Franc', description: 'Another safe haven pair' },
      'AUDUSD': { name: 'Australian Dollar vs US Dollar', description: 'Commodity currency pair' },
      'USDCAD': { name: 'US Dollar vs Canadian Dollar', description: 'Oil-dependent pair' }
    };

    return pairs[pair] || null;
  }
}

module.exports = ForexMenu;