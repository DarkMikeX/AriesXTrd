/**
 * Timeframe Menu
 * Handles timeframe selection for analysis
 */

const Logger = require('../utils/Logger');

class TimeframeMenu {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
    this.timeframes = {
      '1m': { label: '1 Minute', value: '1m', description: 'M1 - Ultra short term' },
      '5m': { label: '5 Minutes', value: '5m', description: 'M5 - Short term scalping' },
      '15m': { label: '15 Minutes', value: '15m', description: 'M15 - Short term' },
      '30m': { label: '30 Minutes', value: '30m', description: 'M30 - Intraday' },
      '1H': { label: '1 Hour', value: '1H', description: 'H1 - Intraday swing' },
      '4H': { label: '4 Hours', value: '4H', description: 'H4 - Medium term' },
      '1D': { label: '1 Day', value: '1D', description: 'D1 - Daily swing' },
      '1W': { label: '1 Week', value: '1W', description: 'W1 - Long term' }
    };
  }

  /**
   * Show timeframe selection menu
   */
  async show(ctx, assetSymbol, assetType) {
    let message, keyboard;

    if (assetSymbol) {
      // If symbol provided, show timeframe selection for that specific symbol
      message = `📊 *Select Timeframe for ${assetSymbol}*

Choose the timeframe to analyze ${assetType} charts and candles:

• *1m-15m* - Scalping & Quick trades
• *30m-4H* - Intraday & Swing trades  
• *1D-1W* - Position & Long-term trades

*Recommended:* 5m for forex, 1H for stocks, 4H for crypto`;

      keyboard = {
        inline_keyboard: [
          [
            { text: '1m', callback_data: `timeframe_${assetSymbol}_${assetType}_1m` },
            { text: '5m', callback_data: `timeframe_${assetSymbol}_${assetType}_5m` },
            { text: '15m', callback_data: `timeframe_${assetSymbol}_${assetType}_15m` }
          ],
          [
            { text: '30m', callback_data: `timeframe_${assetSymbol}_${assetType}_30m` },
            { text: '1H', callback_data: `timeframe_${assetSymbol}_${assetType}_1H` },
            { text: '4H', callback_data: `timeframe_${assetSymbol}_${assetType}_4H` }
          ],
          [
            { text: '1D', callback_data: `timeframe_${assetSymbol}_${assetType}_1D` },
            { text: '1W', callback_data: `timeframe_${assetSymbol}_${assetType}_1W` }
          ],
          [
            { text: '🔙 Back', callback_data: 'back_previous' }
          ]
        ]
      };
    } else {
      // No symbol yet - selecting timeframe first, then will show assets
      // For Forex, use short timeframes like in screenshot (5s, 15s, 30s, 1m, 2m, 3m, 5m, 10m)
      if (assetType === 'forex' || assetType === 'Forex') {
        message = `Select trading time for EUR/USD OTC:`;
        
        keyboard = {
          inline_keyboard: [
            [
              { text: '5 seconds', callback_data: `tf_select_${assetType}_5s` },
              { text: '15 seconds', callback_data: `tf_select_${assetType}_15s` },
              { text: '30 seconds', callback_data: `tf_select_${assetType}_30s` }
            ],
            [
              { text: '1 minutes', callback_data: `tf_select_${assetType}_1m` },
              { text: '2 minutes', callback_data: `tf_select_${assetType}_2m` },
              { text: '3 minutes', callback_data: `tf_select_${assetType}_3m` }
            ],
            [
              { text: '5 minutes', callback_data: `tf_select_${assetType}_5m` },
              { text: '10 minutes', callback_data: `tf_select_${assetType}_10m` }
            ],
            [
              { text: '🔙 Back', callback_data: 'back_main' }
            ]
          ]
        };
      } else {
        // For other asset types, use standard timeframes
        const assetEmoji = assetType === 'stock' ? '📱' : '🪙';
        message = `📊 *Select Timeframe for ${assetEmoji} ${assetType.toUpperCase()} Trading*

Choose the timeframe to analyze charts and candles:`;

        keyboard = {
          inline_keyboard: [
            [
              { text: '1m', callback_data: `tf_select_${assetType}_1m` },
              { text: '5m', callback_data: `tf_select_${assetType}_5m` },
              { text: '15m', callback_data: `tf_select_${assetType}_15m` }
            ],
            [
              { text: '30m', callback_data: `tf_select_${assetType}_30m` },
              { text: '1H', callback_data: `tf_select_${assetType}_1H` },
              { text: '4H', callback_data: `tf_select_${assetType}_4H` }
            ],
            [
              { text: '1D', callback_data: `tf_select_${assetType}_1D` },
              { text: '1W', callback_data: `tf_select_${assetType}_1W` }
            ],
            [
              { text: '🔙 Back', callback_data: 'back_main' }
            ]
          ]
        };
      }
    }

    try {
      if (ctx.callbackQuery) {
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
      this.logger.error('Error showing timeframe menu', { error: error.message });
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  }

  /**
   * Get timeframe label
   */
  getTimeframeLabel(timeframe) {
    return this.timeframes[timeframe]?.label || timeframe;
  }

  /**
   * Get all timeframes
   */
  getTimeframes() {
    return Object.values(this.timeframes);
  }
}

module.exports = TimeframeMenu;
