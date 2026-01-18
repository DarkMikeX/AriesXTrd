/**
 * Crypto Menu
 * Handles crypto-specific menu interactions
 */

const Logger = require('../utils/Logger');

class CryptoMenu {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Show crypto menu
   */
  async show(ctx) {
    const message = `Select a cryptocurrency to analyze:\n\n🪙 *Popular Cryptocurrencies:*\n• BTCUSD - Bitcoin\n• ETHUSD - Ethereum\n• BNBUSD - Binance Coin\n• ADAUSD - Cardano\n• SOLUSD - Solana`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '₿ BTCUSD', callback_data: 'analyze_BTCUSD' },
          { text: 'Ξ ETHUSD', callback_data: 'analyze_ETHUSD' }
        ],
        [
          { text: '💎 BNBUSD', callback_data: 'analyze_BNBUSD' },
          { text: '₳ ADAUSD', callback_data: 'analyze_ADAUSD' }
        ],
        [
          { text: '◎ SOLUSD', callback_data: 'analyze_SOLUSD' },
          { text: '🐕 DOGEUSD', callback_data: 'analyze_DOGEUSD' }
        ],
        [
          { text: '🔙 Back', callback_data: 'back_main' },
          { text: '✏️ Custom Coin', callback_data: 'analyze_custom' }
        ]
      ]
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Get crypto information
   */
  getCryptoInfo(symbol) {
    const cryptos = {
      'BTCUSD': { name: 'Bitcoin', description: 'Original cryptocurrency' },
      'ETHUSD': { name: 'Ethereum', description: 'Smart contracts platform' },
      'BNBUSD': { name: 'Binance Coin', description: 'Binance exchange token' },
      'ADAUSD': { name: 'Cardano', description: 'Proof-of-stake blockchain' },
      'SOLUSD': { name: 'Solana', description: 'High-performance blockchain' },
      'DOGEUSD': { name: 'Dogecoin', description: 'Meme cryptocurrency' }
    };

    return cryptos[symbol] || null;
  }
}

module.exports = CryptoMenu;