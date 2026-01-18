/**
 * Stock Menu
 * Handles stock-specific menu interactions
 */

const Logger = require('../utils/Logger');

class StockMenu {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Show stock menu
   */
  async show(ctx) {
    const message = `Select a stock to analyze:\n\n📱 *Popular Stocks:*\n• AAPL - Apple Inc.\n• TSLA - Tesla Inc.\n• MSFT - Microsoft Corp.\n• AMZN - Amazon.com Inc.\n• GOOGL - Alphabet Inc.\n• META - Meta Platforms\n• NVDA - NVIDIA Corp.\n• NFLX - Netflix Inc.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 AAPL', callback_data: 'analyze_AAPL' },
          { text: '⚡ TSLA', callback_data: 'analyze_TSLA' }
        ],
        [
          { text: '💻 MSFT', callback_data: 'analyze_MSFT' },
          { text: '📦 AMZN', callback_data: 'analyze_AMZN' }
        ],
        [
          { text: '🔍 GOOGL', callback_data: 'analyze_GOOGL' },
          { text: '👥 META', callback_data: 'analyze_META' }
        ],
        [
          { text: '🎮 NVDA', callback_data: 'analyze_NVDA' },
          { text: '🎬 NFLX', callback_data: 'analyze_NFLX' }
        ],
        [
          { text: '🔙 Back', callback_data: 'back_main' },
          { text: '✏️ Custom Symbol', callback_data: 'analyze_custom' }
        ]
      ]
    };

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Get stock information
   */
  getStockInfo(symbol) {
    const stocks = {
      'AAPL': { name: 'Apple Inc.', sector: 'Technology', description: 'iPhone, Mac, iPad manufacturer' },
      'TSLA': { name: 'Tesla Inc.', sector: 'Automotive', description: 'Electric vehicles and clean energy' },
      'MSFT': { name: 'Microsoft Corp.', sector: 'Technology', description: 'Software and cloud computing' },
      'AMZN': { name: 'Amazon.com Inc.', sector: 'E-commerce', description: 'Online retail and cloud services' },
      'GOOGL': { name: 'Alphabet Inc.', sector: 'Technology', description: 'Google search and online services' },
      'META': { name: 'Meta Platforms', sector: 'Technology', description: 'Facebook, Instagram, social media' },
      'NVDA': { name: 'NVIDIA Corp.', sector: 'Technology', description: 'Graphics processing units' },
      'NFLX': { name: 'Netflix Inc.', sector: 'Entertainment', description: 'Streaming video service' }
    };

    return stocks[symbol] || null;
  }
}

module.exports = StockMenu;