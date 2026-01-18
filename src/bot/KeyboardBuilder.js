/**
 * Keyboard Builder
 * Utility class for building Telegram inline keyboards and reply keyboards
 */

class KeyboardBuilder {
  constructor() {
    this.keyboards = {};
    this.templates = {};
  }

  /**
   * Create main menu keyboard
   */
  createMainMenu() {
    return {
      inline_keyboard: [
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
  }

  /**
   * Create asset selection keyboard
   */
  createAssetMenu(assetType, assets) {
    const buttons = [];
    const emoji = this.getAssetEmoji(assetType);

    // Add asset buttons in rows of 3
    for (let i = 0; i < assets.length; i += 3) {
      const row = assets.slice(i, i + 3).map(asset => ({
        text: `${emoji} ${asset.symbol}`,
        callback_data: `analyze_${asset.symbol}`
      }));
      buttons.push(row);
    }

    // Add navigation buttons
    buttons.push([
      { text: '🔙 Back', callback_data: 'back_main' },
      { text: '✏️ Enter Symbol', callback_data: 'analyze_custom' }
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * Create trade action keyboard
   */
  createTradeActions(symbol, direction = 'CALL') {
    return {
      inline_keyboard: [
        [
          { text: '✅ Execute $5', callback_data: 'trade_5' },
          { text: '💰 Execute $10', callback_data: 'trade_10' }
        ],
        [
          { text: '💵 Custom Amount', callback_data: 'trade_custom' },
          { text: '📊 View Chart', callback_data: 'view_chart' }
        ],
        [
          { text: '🔄 Re-analyze', callback_data: `analyze_${symbol}` },
          { text: '❌ Cancel', callback_data: 'cancel' }
        ]
      ]
    };
  }

  /**
   * Create settings menu keyboard
   */
  createSettingsMenu() {
    return {
      inline_keyboard: [
        [{ text: '📊 Trading Settings', callback_data: 'settings_trading' }],
        [{ text: '⚠️ Risk Management', callback_data: 'settings_risk' }],
        [{ text: '🔔 Notifications', callback_data: 'settings_notifications' }],
        [{ text: '🎯 Asset Preferences', callback_data: 'settings_assets' }],
        [{ text: '💾 Save Settings', callback_data: 'settings_save' }],
        [{ text: '🔙 Back', callback_data: 'back_main' }]
      ]
    };
  }

  /**
   * Create confirmation keyboard
   */
  createConfirmation(action, yesText = '✅ Yes', noText = '❌ Cancel') {
    return {
      inline_keyboard: [
        [
          { text: yesText, callback_data: `confirm_${action}` },
          { text: noText, callback_data: 'cancel' }
        ]
      ]
    };
  }

  /**
   * Create navigation keyboard
   */
  createNavigation(backTo = 'main', additional = []) {
    const buttons = [];

    if (additional.length > 0) {
      buttons.push(additional);
    }

    buttons.push([
      { text: '🔙 Back', callback_data: `back_${backTo}` }
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * Create pagination keyboard
   */
  createPagination(currentPage, totalPages, prefix = 'page') {
    const buttons = [];

    // Previous/Next buttons
    const navButtons = [];
    if (currentPage > 1) {
      navButtons.push({ text: '⬅️ Previous', callback_data: `${prefix}_${currentPage - 1}` });
    }

    navButtons.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });

    if (currentPage < totalPages) {
      navButtons.push({ text: 'Next ➡️', callback_data: `${prefix}_${currentPage + 1}` });
    }

    buttons.push(navButtons);

    // Back button
    buttons.push([
      { text: '🔙 Back', callback_data: 'back_main' }
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * Create amount selection keyboard
   */
  createAmountSelection(amounts = [1, 5, 10, 25, 50, 100]) {
    const buttons = [];

    // Add amount buttons in rows of 3
    for (let i = 0; i < amounts.length; i += 3) {
      const row = amounts.slice(i, i + 3).map(amount => ({
        text: `$${amount}`,
        callback_data: `trade_${amount}`
      }));
      buttons.push(row);
    }

    // Add custom and cancel
    buttons.push([
      { text: '💵 Custom Amount', callback_data: 'trade_custom' },
      { text: '❌ Cancel', callback_data: 'cancel' }
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * Create time selection keyboard
   */
  createTimeSelection(times = [1, 5, 15, 30, 60]) {
    const buttons = [];

    // Add time buttons in rows of 3
    for (let i = 0; i < times.length; i += 3) {
      const row = times.slice(i, i + 3).map(time => ({
        text: `${time} min`,
        callback_data: `time_${time}`
      }));
      buttons.push(row);
    }

    buttons.push([
      { text: '🔙 Back', callback_data: 'back_trade' }
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * Create stats navigation keyboard
   */
  createStatsNavigation() {
    return {
      inline_keyboard: [
        [{ text: '📄 Export Report', callback_data: 'stats_export' }],
        [{ text: '📊 Chart View', callback_data: 'stats_chart' }],
        [{ text: '📈 Performance', callback_data: 'stats_performance' }],
        [{ text: '🔙 Back', callback_data: 'back_main' }]
      ]
    };
  }

  /**
   * Create help keyboard
   */
  createHelpKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '📊 Trading', callback_data: 'help_trading' }],
        [{ text: '⚙️ Settings', callback_data: 'help_settings' }],
        [{ text: '🆘 Support', callback_data: 'help_support' }],
        [{ text: '🔙 Back', callback_data: 'back_main' }]
      ]
    };
  }

  /**
   * Create risk settings keyboard
   */
  createRiskSettingsKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '💰 Daily Loss Limit', callback_data: 'risk_daily_loss' }],
        [{ text: '📈 Daily Profit Target', callback_data: 'risk_daily_profit' }],
        [{ text: '💵 Max Trade Amount', callback_data: 'risk_max_trade' }],
        [{ text: '🔄 Consecutive Losses', callback_data: 'risk_consecutive' }],
        [{ text: '💾 Save Settings', callback_data: 'risk_save' }],
        [{ text: '🔙 Back', callback_data: 'back_settings' }]
      ]
    };
  }

  /**
   * Create notification settings keyboard
   */
  createNotificationSettingsKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '✅ Trade Confirmations', callback_data: 'notif_trade_confirm' }],
        [{ text: '🎯 Win/Loss Alerts', callback_data: 'notif_win_loss' }],
        [{ text: '📊 Daily Summary', callback_data: 'notif_daily_summary' }],
        [{ text: '🚨 Signal Alerts', callback_data: 'notif_signals' }],
        [{ text: '💾 Save Settings', callback_data: 'notif_save' }],
        [{ text: '🔙 Back', callback_data: 'back_settings' }]
      ]
    };
  }

  /**
   * Create asset preferences keyboard
   */
  createAssetPreferencesKeyboard(currentPrefs = {}) {
    const stocks = currentPrefs.stocks ? '✅' : '⬜';
    const forex = currentPrefs.forex ? '✅' : '⬜';
    const crypto = currentPrefs.crypto ? '✅' : '⬜';

    return {
      inline_keyboard: [
        [{ text: `${stocks} Stocks`, callback_data: 'pref_stocks' }],
        [{ text: `${forex} Forex`, callback_data: 'pref_forex' }],
        [{ text: `${crypto} Crypto`, callback_data: 'pref_crypto' }],
        [{ text: '💾 Save Preferences', callback_data: 'pref_save' }],
        [{ text: '🔙 Back', callback_data: 'back_settings' }]
      ]
    };
  }

  /**
   * Get asset emoji
   */
  getAssetEmoji(assetType) {
    const emojis = {
      stocks: '📱',
      forex: '💱',
      crypto: '🪙',
      commodities: '🛢️',
      indices: '📊'
    };
    return emojis[assetType] || '📊';
  }

  /**
   * Create custom keyboard from array
   */
  createFromArray(buttons, columns = 2) {
    const keyboard = [];
    for (let i = 0; i < buttons.length; i += columns) {
      keyboard.push(buttons.slice(i, i + columns));
    }
    return { inline_keyboard: keyboard };
  }

  /**
   * Add back button to existing keyboard
   */
  addBackButton(keyboard, backTo = 'main') {
    if (!keyboard.inline_keyboard) return keyboard;

    keyboard.inline_keyboard.push([
      { text: '🔙 Back', callback_data: `back_${backTo}` }
    ]);

    return keyboard;
  }

  /**
   * Create reply keyboard (for text input)
   */
  createReplyKeyboard(buttons, options = {}) {
    const keyboard = [];
    const columns = options.columns || 2;

    for (let i = 0; i < buttons.length; i += columns) {
      keyboard.push(buttons.slice(i, i + columns));
    }

    return {
      keyboard,
      resize_keyboard: options.resize !== false,
      one_time_keyboard: options.oneTime !== false,
      selective: options.selective || false
    };
  }

  /**
   * Remove keyboard
   */
  removeKeyboard() {
    return { remove_keyboard: true };
  }

  /**
   * Create force reply
   */
  forceReply() {
    return { force_reply: true };
  }

  /**
   * Store keyboard template
   */
  storeTemplate(name, keyboard) {
    this.templates[name] = keyboard;
  }

  /**
   * Get stored template
   */
  getTemplate(name) {
    return this.templates[name] || null;
  }

  /**
   * List available templates
   */
  listTemplates() {
    return Object.keys(this.templates);
  }

  /**
   * Clear stored templates
   */
  clearTemplates() {
    this.templates = {};
  }

  /**
   * Validate keyboard structure
   */
  validateKeyboard(keyboard) {
    if (!keyboard || typeof keyboard !== 'object') return false;

    if (keyboard.inline_keyboard) {
      return Array.isArray(keyboard.inline_keyboard) &&
             keyboard.inline_keyboard.every(row =>
               Array.isArray(row) &&
               row.every(button =>
                 button && typeof button === 'object' &&
                 button.text && button.callback_data
               )
             );
    }

    if (keyboard.keyboard) {
      return Array.isArray(keyboard.keyboard) &&
             keyboard.keyboard.every(row =>
               Array.isArray(row) &&
               row.every(button => typeof button === 'string')
             );
    }

    return false;
  }

  /**
   * Create keyboard from configuration
   */
  createFromConfig(config) {
    if (!config || !config.type) return null;

    switch (config.type) {
      case 'main_menu':
        return this.createMainMenu();

      case 'asset_menu':
        return this.createAssetMenu(config.assetType, config.assets);

      case 'trade_actions':
        return this.createTradeActions(config.symbol, config.direction);

      case 'settings':
        return this.createSettingsMenu();

      case 'confirmation':
        return this.createConfirmation(config.action, config.yesText, config.noText);

      case 'navigation':
        return this.createNavigation(config.backTo, config.additional);

      case 'pagination':
        return this.createPagination(config.currentPage, config.totalPages, config.prefix);

      case 'amount_selection':
        return this.createAmountSelection(config.amounts);

      case 'time_selection':
        return this.createTimeSelection(config.times);

      default:
        return null;
    }
  }
}

module.exports = KeyboardBuilder;