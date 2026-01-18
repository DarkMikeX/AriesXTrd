/**
 * Main Menu
 * Handles the main navigation menu for the bot
 */

const Logger = require('../utils/Logger');

class MainMenu {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Show main menu
   */
  async show(ctx) {
    const message = `👋 *Welcome to Trading Bot!*

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

    try {
      if (ctx.callbackQuery || ctx.message?.message_id) {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } catch (error) {
      // Fallback to reply if editMessageText fails
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  }

  /**
   * Handle menu navigation
   */
  async handleNavigation(ctx, menuType) {
    switch (menuType) {
      case 'stocks':
        await this.showAssetMenu(ctx, 'stocks');
        break;

      case 'forex':
        await this.showAssetMenu(ctx, 'forex');
        break;

      case 'crypto':
        await this.showAssetMenu(ctx, 'crypto');
        break;

      case 'stats':
        // Delegate to stats handler
        break;

      case 'settings':
        // Delegate to settings handler
        break;

      default:
        await ctx.answerCbQuery('Menu not found');
    }
  }

  /**
   * Show asset menu for specific type
   * NOTE: This is now handled by CallbackHandler.showAssetMenu
   * This method is kept for backward compatibility but should not be used
   */
  async showAssetMenu(ctx, assetType) {
    // Delegate to CallbackHandler which has the new implementation
    if (this.services?.callbackHandler) {
      await this.services.callbackHandler.showAssetMenu(ctx, assetType);
    } else {
      // Fallback - should not happen
      await ctx.reply('Please use the main menu buttons.');
    }
  }

  /**
   * Get assets for type
   */
  getAssetsForType(assetType) {
    // This would come from config or database
    const assetConfigs = {
      stocks: [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corp.' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' }
      ],
      forex: [
        { symbol: 'EURUSD', name: 'Euro vs US Dollar' },
        { symbol: 'GBPUSD', name: 'British Pound vs US Dollar' },
        { symbol: 'USDJPY', name: 'US Dollar vs Japanese Yen' },
        { symbol: 'USDCHF', name: 'US Dollar vs Swiss Franc' },
        { symbol: 'AUDUSD', name: 'Australian Dollar vs US Dollar' }
      ],
      crypto: [
        { symbol: 'BTCUSD', name: 'Bitcoin' },
        { symbol: 'ETHUSD', name: 'Ethereum' },
        { symbol: 'BNBUSD', name: 'Binance Coin' }
      ]
    };

    return assetConfigs[assetType] || [];
  }

  /**
   * Get asset emoji
   */
  getAssetEmoji(assetType) {
    const emojis = {
      stocks: '📱',
      forex: '💱',
      crypto: '🪙'
    };
    return emojis[assetType] || '📊';
  }
}

module.exports = MainMenu;